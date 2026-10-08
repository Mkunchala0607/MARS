INSERT INTO screens (code, name, group_name) VALUES ('gate_registers', 'Registers', 'Security') ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, screen_code)
SELECT id, 'gate_registers' FROM roles WHERE code IN ('admin', 'store', 'security')
ON CONFLICT DO NOTHING;
