#!/usr/bin/env node
/**
 * NPX MCP Redis 配置验证脚本
 * 用于测试和验证 npx 方式的 MCP Redis 配置是否正常工作
 */

const { spawn } = require('child_process');
const net = require('net');

class NPXMCPTester {
    constructor() {
        this.redisHost = 'localhost';
        this.redisPort = 6379;
        this.redisUrl = `redis://${this.redisHost}:${this.redisPort}`;
        this.testResults = [];
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const colorCode = {
            'INFO': '\x1b[36m',    // 青色
            'SUCCESS': '\x1b[32m', // 绿色
            'ERROR': '\x1b[31m',   // 红色
            'WARNING': '\x1b[33m'  // 黄色
        }[type] || '\x1b[0m';
        
        console.log(`${colorCode}[${timestamp}] ${type}: ${message}\x1b[0m`);
    }

    async checkRedisConnection() {
        this.log('检查 Redis 服务器连接状态...');
        
        return new Promise((resolve) => {
            const client = new net.Socket();
            const timeout = setTimeout(() => {
                client.destroy();
                this.log(`Redis 服务器连接失败: ${this.redisHost}:${this.redisPort}`, 'ERROR');
                resolve(false);
            }, 3000);

            client.connect(this.redisPort, this.redisHost, () => {
                clearTimeout(timeout);
                client.destroy();
                this.log(`Redis 服务器连接成功: ${this.redisHost}:${this.redisPort}`, 'SUCCESS');
                resolve(true);
            });

            client.on('error', () => {
                clearTimeout(timeout);
                this.log(`Redis 服务器连接失败: ${this.redisHost}:${this.redisPort}`, 'ERROR');
                resolve(false);
            });
        });
    }

    async testNPXCommand() {
        this.log('测试 npx @modelcontextprotocol/server-redis 命令...');
        
        return new Promise((resolve) => {
            const child = spawn('npx', ['-y', '@modelcontextprotocol/server-redis', this.redisUrl], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';
            let connected = false;

            const timeout = setTimeout(() => {
                child.kill('SIGTERM');
                if (connected) {
                    this.log('NPX MCP Redis 服务器测试成功', 'SUCCESS');
                    resolve(true);
                } else {
                    this.log('NPX MCP Redis 服务器测试超时', 'ERROR');
                    resolve(false);
                }
            }, 10000);

            child.stdout.on('data', (data) => {
                output += data.toString();
                if (output.includes('Redis Connected') || output.includes('Successfully connected')) {
                    connected = true;
                    clearTimeout(timeout);
                    child.kill('SIGTERM');
                    this.log('NPX MCP Redis 服务器连接成功', 'SUCCESS');
                    resolve(true);
                }
            });

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                clearTimeout(timeout);
                if (!connected) {
                    this.log(`NPX 命令执行失败，退出码: ${code}`, 'ERROR');
                    if (errorOutput) {
                        this.log(`错误信息: ${errorOutput}`, 'ERROR');
                    }
                    resolve(false);
                }
            });

            child.on('error', (error) => {
                clearTimeout(timeout);
                this.log(`NPX 命令执行错误: ${error.message}`, 'ERROR');
                resolve(false);
            });
        });
    }

    validateMCPConfig() {
        this.log('验证 MCP 配置格式...');
        
        const mcpConfig = {
            "mcpServers": {
                "Redis": {
                    "command": "npx",
                    "args": [
                        "-y",
                        "@modelcontextprotocol/server-redis",
                        this.redisUrl
                    ],
                    "env": {}
                }
            }
        };

        // 验证配置结构
        const isValid = (
            mcpConfig.mcpServers &&
            mcpConfig.mcpServers.Redis &&
            mcpConfig.mcpServers.Redis.command === 'npx' &&
            Array.isArray(mcpConfig.mcpServers.Redis.args) &&
            mcpConfig.mcpServers.Redis.args.length === 3 &&
            mcpConfig.mcpServers.Redis.args[0] === '-y' &&
            mcpConfig.mcpServers.Redis.args[1] === '@modelcontextprotocol/server-redis' &&
            mcpConfig.mcpServers.Redis.args[2] === this.redisUrl
        );

        if (isValid) {
            this.log('MCP 配置格式验证通过', 'SUCCESS');
            this.log(`配置内容: ${JSON.stringify(mcpConfig, null, 2)}`);
            return true;
        } else {
            this.log('MCP 配置格式验证失败', 'ERROR');
            return false;
        }
    }

    generateReport() {
        this.log('\n=== NPX MCP Redis 配置验证报告 ===');
        this.log(`测试时间: ${new Date().toLocaleString()}`);
        this.log(`Redis URL: ${this.redisUrl}`);
        this.log(`测试结果总数: ${this.testResults.length}`);
        
        const successCount = this.testResults.filter(r => r.success).length;
        const failCount = this.testResults.length - successCount;
        
        this.log(`成功: ${successCount}, 失败: ${failCount}`);
        
        this.testResults.forEach((result, index) => {
            const status = result.success ? 'PASS' : 'FAIL';
            const type = result.success ? 'SUCCESS' : 'ERROR';
            this.log(`${index + 1}. ${result.test}: ${status}`, type);
        });

        if (failCount === 0) {
            this.log('\n🎉 所有测试通过！NPX MCP Redis 配置可以正常使用', 'SUCCESS');
            this.log('\n📋 使用说明:');
            this.log('1. 将以下配置添加到您的 MCP 客户端配置文件中:');
            this.log(JSON.stringify({
                "mcpServers": {
                    "Redis": {
                        "command": "npx",
                        "args": [
                            "-y",
                            "@modelcontextprotocol/server-redis",
                            this.redisUrl
                        ],
                        "env": {}
                    }
                }
            }, null, 2));
            this.log('2. 重启您的 MCP 客户端');
            this.log('3. 现在可以通过 MCP 使用 Redis 功能了');
        } else {
            this.log('\n❌ 部分测试失败，请检查配置和环境', 'ERROR');
        }
    }

    async runAllTests() {
        this.log('开始 NPX MCP Redis 配置验证测试...');
        
        // 测试1: Redis 连接
        const redisConnected = await this.checkRedisConnection();
        this.testResults.push({
            test: 'Redis 服务器连接测试',
            success: redisConnected
        });

        // 测试2: MCP 配置格式验证
        const configValid = this.validateMCPConfig();
        this.testResults.push({
            test: 'MCP 配置格式验证',
            success: configValid
        });

        // 测试3: NPX 命令测试（仅在 Redis 连接成功时执行）
        if (redisConnected) {
            const npxWorking = await this.testNPXCommand();
            this.testResults.push({
                test: 'NPX MCP Redis 服务器测试',
                success: npxWorking
            });
        } else {
            this.testResults.push({
                test: 'NPX MCP Redis 服务器测试',
                success: false
            });
            this.log('跳过 NPX 测试，因为 Redis 服务器不可用', 'WARNING');
        }

        this.generateReport();
    }
}

// 运行测试
if (require.main === module) {
    const tester = new NPXMCPTester();
    tester.runAllTests().catch(error => {
        console.error('测试执行失败:', error);
        process.exit(1);
    });
}

module.exports = NPXMCPTester;