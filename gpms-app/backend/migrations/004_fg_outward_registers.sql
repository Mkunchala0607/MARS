CREATE TABLE fg_outward_registers (
  id serial PRIMARY KEY,
  gate varchar(50) NOT NULL,
  serial_number varchar(100),
  party_name varchar(100) NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL,
  invoice_number varchar(100) NOT NULL,
  vehicle_number varchar(50) NOT NULL,
  driver_signature varchar(100),
  security_signature varchar(100),
  remarks text,
  recorded_by int REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
