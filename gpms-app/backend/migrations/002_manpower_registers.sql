CREATE TABLE manpower_registers (
  id serial PRIMARY KEY,
  gate varchar(50) NOT NULL,
  category varchar(50) NOT NULL,
  subcategory varchar(50) NOT NULL,
  person_name varchar(100) NOT NULL,
  id_number varchar(100) NOT NULL,
  in_time timestamptz DEFAULT now(),
  out_time timestamptz,
  recorded_by int REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gate Registers access control
INSERT INTO screens (code, name, group_name) VALUES ('gate_registers', 'Registers (Manpower)', 'Security') ON CONFLICT DO NOTHING;
