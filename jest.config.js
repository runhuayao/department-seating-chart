module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 根目录
  rootDir: '.',
  
  // 测试文件匹配模式
  testMatch: [
    '<rootDir>/src/server/tests/**/*.test.ts',
    '<rootDir>/src/server/tests/**/*.spec.ts'
  ],
  
  // 忽略的测试文件
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // TypeScript 支持
  preset: 'ts-jest',
  
  // 模块文件扩展名
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // 模块名映射
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@server/(.*)$': '<rootDir>/src/server/$1',
    '^@client/(.*)$': '<rootDir>/src/client/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1'
  },
  
  // 转换配置
  transform: {
    '^.+\\.ts$': 'ts-jest',
    '^.+\\.tsx$': 'ts-jest'
  },
  
  // 覆盖率配置
  collectCoverage: true,
  collectCoverageFrom: [
    'src/server/**/*.ts',
    '!src/server/**/*.d.ts',
    '!src/server/tests/**/*',
    '!src/server/**/*.test.ts',
    '!src/server/**/*.spec.ts',
    '!src/server/dist/**/*',
    '!src/server/node_modules/**/*'
  ],
  
  // 覆盖率报告
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json'
  ],
  
  // 覆盖率输出目录
  coverageDirectory: '<rootDir>/coverage',
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // 核心组件要求更高覆盖率
    'src/server/core/websocket/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/server/core/database/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/server/core/security/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // 设置文件
  setupFilesAfterEnv: [
    '<rootDir>/src/server/tests/setup.ts'
  ],
  
  // 全局设置
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          moduleResolution: 'node',
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          strict: true,
          noImplicitAny: true,
          strictNullChecks: true,
          strictFunctionTypes: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedIndexedAccess: true
        }
      }
    }
  },
  
  // 测试超时时间
  testTimeout: 30000,
  
  // 详细输出
  verbose: true,
  
  // 错误时停止
  bail: false,
  
  // 最大并发数
  maxConcurrency: 5,
  
  // 最大工作进程数
  maxWorkers: '50%',
  
  // 缓存
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // 清除模拟
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  
  // 错误报告
  errorOnDeprecated: true,
  
  // 通知配置
  notify: false,
  notifyMode: 'failure-change',
  
  // 测试结果处理器
  testResultsProcessor: undefined,
  
  // 自定义报告器
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: '<rootDir>/coverage/html-report',
        filename: 'test-report.html',
        expand: true,
        hideIcon: false,
        pageTitle: '部门地图 - 测试报告',
        logoImgPath: undefined,
        inlineSource: false
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/coverage',
        outputName: 'junit.xml',
        ancestorSeparator: ' › ',
        uniqueOutputName: false,
        suiteNameTemplate: '{filepath}',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}'
      }
    ]
  ],
  
  // 环境变量
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // 模拟配置
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],
  
  // 监视模式配置
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  
  // 快照序列化器
  snapshotSerializers: [],
  
  // 自定义匹配器
  setupFiles: [],
  
  // 测试运行前的钩子
  globalSetup: undefined,
  
  // 测试运行后的钩子
  globalTeardown: undefined,
  
  // 项目配置（用于多项目设置）
  projects: undefined,
  
  // 运行器
  runner: 'jest-runner',
  
  // 测试序列化
  testSequencer: '@jest/test-sequencer',
  
  // 转换忽略模式
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$))'
  ],
  
  // 未模拟的模块路径模式
  unmockedModulePathPatterns: undefined,
  
  // 监视插件
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // 强制退出
  forceExit: false,
  
  // 检测打开的句柄
  detectOpenHandles: true,
  
  // 检测泄漏
  detectLeaks: false,
  
  // 随机化测试顺序
  randomize: false,
  
  // 种子
  seed: undefined,
  
  // 静默模式
  silent: false,
  
  // 跳过过滤器
  skipFilter: false,
  
  // 更新快照
  updateSnapshot: false,
  
  // 使用stderr
  useStderr: false,
  
  // 监视
  watch: false,
  
  // 监视所有
  watchAll: false
};