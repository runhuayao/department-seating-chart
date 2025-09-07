#!/usr/bin/env node

/**
 * 数据验证和完整性检查工具
 * 验证M1数据库中的数据完整性和一致性
 */

const { Pool } = require('pg');

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'department_map',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

/**
 * 验证结果收集器
 */
class ValidationResult {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.errors = [];
    this.warnings_list = [];
  }
  
  pass(message) {
    this.passed++;
    console.log(`✓ ${message}`);
  }
  
  fail(message, details = null) {
    this.failed++;
    this.errors.push({ message, details });
    console.log(`✗ ${message}`);
    if (details) {
      console.log(`  详情: ${details}`);
    }
  }
  
  warn(message, details = null) {
    this.warnings++;
    this.warnings_list.push({ message, details });
    console.log(`⚠️  ${message}`);
    if (details) {
      console.log(`  详情: ${details}`);
    }
  }
  
  getSummary() {
    return {
      total: this.passed + this.failed + this.warnings,
      passed: this.passed,
      failed: this.failed,
      warnings: this.warnings,
      success: this.failed === 0
    };
  }
}

/**
 * 基础连接验证
 */
async function validateConnection(result) {
  console.log('\n🔌 验证数据库连接...');
  
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    result.pass('数据库连接正常');
  } catch (error) {
    result.fail('数据库连接失败', error.message);
    throw error;
  }
}

/**
 * 表结构验证
 */
async function validateTableStructure(result) {
  console.log('\n🏗️  验证表结构...');
  
  const client = await pool.connect();
  try {
    // 检查必需的表是否存在
    const requiredTables = [
      'departments', 'employees', 'desks', 
      'desk_assignments', 'employee_status_logs'
    ];
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1)
    `, [requiredTables]);
    
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    for (const table of requiredTables) {
      if (existingTables.includes(table)) {
        result.pass(`表 ${table} 存在`);
      } else {
        result.fail(`表 ${table} 不存在`);
      }
    }
    
    // 检查关键索引
    const indexResult = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes 
      WHERE schemaname = 'public'
        AND tablename IN ('departments', 'employees', 'desks', 'desk_assignments')
    `);
    
    const indexes = indexResult.rows;
    const expectedIndexes = [
      'departments_name_key',
      'employees_employee_number_key',
      'desks_department_id_desk_number_key'
    ];
    
    for (const expectedIndex of expectedIndexes) {
      const found = indexes.some(idx => idx.indexname === expectedIndex);
      if (found) {
        result.pass(`索引 ${expectedIndex} 存在`);
      } else {
        result.warn(`索引 ${expectedIndex} 不存在`);
      }
    }
    
  } catch (error) {
    result.fail('表结构验证失败', error.message);
  } finally {
    client.release();
  }
}

/**
 * 数据完整性验证
 */
async function validateDataIntegrity(result) {
  console.log('\n🔍 验证数据完整性...');
  
  const client = await pool.connect();
  try {
    // 检查部门数据
    const deptResult = await client.query('SELECT COUNT(*) as count FROM departments');
    const deptCount = parseInt(deptResult.rows[0].count);
    
    if (deptCount > 0) {
      result.pass(`部门数据存在 (${deptCount} 个部门)`);
    } else {
      result.fail('没有部门数据');
    }
    
    // 检查员工数据
    const empResult = await client.query('SELECT COUNT(*) as count FROM employees WHERE is_active = true');
    const empCount = parseInt(empResult.rows[0].count);
    
    if (empCount > 0) {
      result.pass(`员工数据存在 (${empCount} 个活跃员工)`);
    } else {
      result.fail('没有活跃员工数据');
    }
    
    // 检查工位数据
    const deskResult = await client.query('SELECT COUNT(*) as count FROM desks');
    const deskCount = parseInt(deskResult.rows[0].count);
    
    if (deskCount > 0) {
      result.pass(`工位数据存在 (${deskCount} 个工位)`);
    } else {
      result.fail('没有工位数据');
    }
    
    // 检查外键约束
    const orphanEmployees = await client.query(`
      SELECT COUNT(*) as count 
      FROM employees e 
      LEFT JOIN departments d ON e.department_id = d.id 
      WHERE d.id IS NULL AND e.is_active = true
    `);
    
    const orphanEmpCount = parseInt(orphanEmployees.rows[0].count);
    if (orphanEmpCount === 0) {
      result.pass('所有员工都有有效的部门关联');
    } else {
      result.fail(`${orphanEmpCount} 个员工没有有效的部门关联`);
    }
    
    const orphanDesks = await client.query(`
      SELECT COUNT(*) as count 
      FROM desks d 
      LEFT JOIN departments dept ON d.department_id = dept.id 
      WHERE dept.id IS NULL
    `);
    
    const orphanDeskCount = parseInt(orphanDesks.rows[0].count);
    if (orphanDeskCount === 0) {
      result.pass('所有工位都有有效的部门关联');
    } else {
      result.fail(`${orphanDeskCount} 个工位没有有效的部门关联`);
    }
    
    const orphanAssignments = await client.query(`
      SELECT COUNT(*) as count 
      FROM desk_assignments da 
      LEFT JOIN desks d ON da.desk_id = d.id 
      LEFT JOIN employees e ON da.employee_id = e.id 
      WHERE d.id IS NULL OR e.id IS NULL
    `);
    
    const orphanAssignCount = parseInt(orphanAssignments.rows[0].count);
    if (orphanAssignCount === 0) {
      result.pass('所有工位分配都有有效的关联');
    } else {
      result.fail(`${orphanAssignCount} 个工位分配没有有效的关联`);
    }
    
  } catch (error) {
    result.fail('数据完整性验证失败', error.message);
  } finally {
    client.release();
  }
}

/**
 * 业务逻辑验证
 */
async function validateBusinessLogic(result) {
  console.log('\n💼 验证业务逻辑...');
  
  const client = await pool.connect();
  try {
    // 检查员工编号唯一性
    const duplicateEmployees = await client.query(`
      SELECT employee_number, COUNT(*) as count 
      FROM employees 
      WHERE is_active = true
      GROUP BY employee_number 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateEmployees.rows.length === 0) {
      result.pass('员工编号唯一性正确');
    } else {
      result.fail(`发现重复的员工编号: ${duplicateEmployees.rows.map(r => r.employee_number).join(', ')}`);
    }
    
    // 检查工位编号在部门内的唯一性
    const duplicateDesks = await client.query(`
      SELECT department_id, desk_number, COUNT(*) as count 
      FROM desks 
      GROUP BY department_id, desk_number 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateDesks.rows.length === 0) {
      result.pass('工位编号在部门内唯一性正确');
    } else {
      result.fail(`发现重复的工位编号: ${duplicateDesks.rows.length} 个`);
    }
    
    // 检查工位分配冲突
    const conflictingAssignments = await client.query(`
      SELECT desk_id, COUNT(*) as count 
      FROM desk_assignments 
      WHERE status = 'active' 
      GROUP BY desk_id 
      HAVING COUNT(*) > 1
    `);
    
    if (conflictingAssignments.rows.length === 0) {
      result.pass('工位分配无冲突');
    } else {
      result.fail(`发现工位分配冲突: ${conflictingAssignments.rows.length} 个工位`);
    }
    
    // 检查员工多重分配
    const multipleAssignments = await client.query(`
      SELECT employee_id, COUNT(*) as count 
      FROM desk_assignments 
      WHERE status = 'active' 
      GROUP BY employee_id 
      HAVING COUNT(*) > 1
    `);
    
    if (multipleAssignments.rows.length === 0) {
      result.pass('员工无多重工位分配');
    } else {
      result.warn(`发现员工多重分配: ${multipleAssignments.rows.length} 个员工`);
    }
    
    // 检查工位状态一致性
    const statusInconsistency = await client.query(`
      SELECT 
        d.id,
        d.desk_number,
        d.status as desk_status,
        CASE WHEN da.id IS NOT NULL THEN 'assigned' ELSE 'unassigned' END as assignment_status
      FROM desks d
      LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
      WHERE 
        (d.status = 'occupied' AND da.id IS NULL) OR
        (d.status = 'available' AND da.id IS NOT NULL)
    `);
    
    if (statusInconsistency.rows.length === 0) {
      result.pass('工位状态与分配关系一致');
    } else {
      result.warn(`工位状态不一致: ${statusInconsistency.rows.length} 个工位`);
    }
    
  } catch (error) {
    result.fail('业务逻辑验证失败', error.message);
  } finally {
    client.release();
  }
}

/**
 * 数据质量验证
 */
async function validateDataQuality(result) {
  console.log('\n📊 验证数据质量...');
  
  const client = await pool.connect();
  try {
    // 检查必填字段
    const nullChecks = [
      { table: 'departments', field: 'name', description: '部门名称' },
      { table: 'departments', field: 'display_name', description: '部门显示名称' },
      { table: 'employees', field: 'name', description: '员工姓名' },
      { table: 'employees', field: 'employee_number', description: '员工编号' },
      { table: 'employees', field: 'department_id', description: '员工部门ID' },
      { table: 'desks', field: 'desk_number', description: '工位编号' },
      { table: 'desks', field: 'department_id', description: '工位部门ID' }
    ];
    
    for (const check of nullChecks) {
      const nullResult = await client.query(
        `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.field} IS NULL`
      );
      
      const nullCount = parseInt(nullResult.rows[0].count);
      if (nullCount === 0) {
        result.pass(`${check.description}无空值`);
      } else {
        result.fail(`${check.description}存在 ${nullCount} 个空值`);
      }
    }
    
    // 检查邮箱格式
    const invalidEmails = await client.query(`
      SELECT COUNT(*) as count 
      FROM employees 
      WHERE email IS NOT NULL 
        AND email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
        AND is_active = true
    `);
    
    const invalidEmailCount = parseInt(invalidEmails.rows[0].count);
    if (invalidEmailCount === 0) {
      result.pass('员工邮箱格式正确');
    } else {
      result.warn(`${invalidEmailCount} 个员工邮箱格式不正确`);
    }
    
    // 检查手机号格式
    const invalidPhones = await client.query(`
      SELECT COUNT(*) as count 
      FROM employees 
      WHERE phone IS NOT NULL 
        AND phone !~ '^1[3-9]\\d{9}$'
        AND is_active = true
    `);
    
    const invalidPhoneCount = parseInt(invalidPhones.rows[0].count);
    if (invalidPhoneCount === 0) {
      result.pass('员工手机号格式正确');
    } else {
      result.warn(`${invalidPhoneCount} 个员工手机号格式不正确`);
    }
    
    // 检查工位坐标合理性
    const invalidPositions = await client.query(`
      SELECT COUNT(*) as count 
      FROM desks 
      WHERE position_x < 0 OR position_y < 0 OR width <= 0 OR height <= 0
    `);
    
    const invalidPosCount = parseInt(invalidPositions.rows[0].count);
    if (invalidPosCount === 0) {
      result.pass('工位坐标和尺寸合理');
    } else {
      result.fail(`${invalidPosCount} 个工位坐标或尺寸不合理`);
    }
    
  } catch (error) {
    result.fail('数据质量验证失败', error.message);
  } finally {
    client.release();
  }
}

/**
 * 性能验证
 */
async function validatePerformance(result) {
  console.log('\n⚡ 验证查询性能...');
  
  const client = await pool.connect();
  try {
    const queries = [
      {
        name: '部门列表查询',
        sql: 'SELECT * FROM departments WHERE status = $1',
        params: ['active']
      },
      {
        name: '员工列表查询',
        sql: 'SELECT * FROM employees WHERE is_active = $1 LIMIT 50',
        params: [true]
      },
      {
        name: '工位分配查询',
        sql: `
          SELECT d.*, e.name as employee_name, e.employee_number
          FROM desks d
          LEFT JOIN desk_assignments da ON d.id = da.desk_id AND da.status = 'active'
          LEFT JOIN employees e ON da.employee_id = e.id
          WHERE d.department_id = $1
        `,
        params: [1]
      }
    ];
    
    for (const query of queries) {
      const startTime = Date.now();
      await client.query(query.sql, query.params);
      const duration = Date.now() - startTime;
      
      if (duration < 100) {
        result.pass(`${query.name}性能良好 (${duration}ms)`);
      } else if (duration < 500) {
        result.warn(`${query.name}性能一般 (${duration}ms)`);
      } else {
        result.fail(`${query.name}性能较差 (${duration}ms)`);
      }
    }
    
  } catch (error) {
    result.fail('性能验证失败', error.message);
  } finally {
    client.release();
  }
}

/**
 * 生成验证报告
 */
function generateValidationReport(result) {
  console.log('\n📋 验证报告');
  console.log('=' .repeat(50));
  
  const summary = result.getSummary();
  
  console.log(`总检查项: ${summary.total}`);
  console.log(`通过: ${summary.passed}`);
  console.log(`失败: ${summary.failed}`);
  console.log(`警告: ${summary.warnings}`);
  
  if (summary.failed > 0) {
    console.log('\n❌ 失败项目:');
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.message}`);
      if (error.details) {
        console.log(`   ${error.details}`);
      }
    });
  }
  
  if (summary.warnings > 0) {
    console.log('\n⚠️  警告项目:');
    result.warnings_list.forEach((warning, index) => {
      console.log(`${index + 1}. ${warning.message}`);
      if (warning.details) {
        console.log(`   ${warning.details}`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (summary.success) {
    console.log('🎉 数据验证通过！');
  } else {
    console.log('💥 数据验证失败，请修复上述问题后重新验证。');
  }
  
  return summary.success;
}

/**
 * 主验证函数
 */
async function runDataValidation() {
  const result = new ValidationResult();
  
  try {
    console.log('🔍 开始数据验证...');
    
    await validateConnection(result);
    await validateTableStructure(result);
    await validateDataIntegrity(result);
    await validateBusinessLogic(result);
    await validateDataQuality(result);
    await validatePerformance(result);
    
    const success = generateValidationReport(result);
    
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 验证过程中发生错误:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 执行验证
if (require.main === module) {
  runDataValidation();
}

module.exports = {
  runDataValidation,
  ValidationResult
};

// 优雅退出处理
process.on('SIGINT', async () => {
  console.log('\n收到退出信号，正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n收到终止信号，正在关闭数据库连接...');
  await pool.end();
  process.exit(0);
});