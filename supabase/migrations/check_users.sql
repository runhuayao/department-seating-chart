-- 查看users表中的数据
SELECT id, username, email, role, is_active, created_at FROM users;

-- 查看employees表中的数据
SELECT id, name, employee_id, email, department_id, status FROM employees LIMIT 5;