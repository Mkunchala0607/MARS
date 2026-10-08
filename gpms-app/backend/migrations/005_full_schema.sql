BEGIN;

DROP TABLE IF EXISTS fg_outward_registers CASCADE;

-- GATE 1
CREATE TABLE fg_outward_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inward_raw_material_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sample_reject_material_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    vehicle_number varchar(50),
    coming_from varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    dc_number varchar(100),
    to_whom varchar(200),
    brought_by varchar(200),
    security_signature text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finished_product_srdc_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE finished_product_nrdc_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bulk_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Material and weighing movement. Weight validation rules need confirmation.
CREATE TABLE main_gate_vehicle_movement_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    slip_number varchar(100),
    in_at timestamptz,
    gross_weight numeric(18,3) CHECK (gross_weight >= 0),
    tare_weight numeric(18,3) CHECK (tare_weight >= 0),
    net_weight numeric(18,3) CHECK (net_weight >= 0),
    weight_unit varchar(30),
    out_at timestamptz,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- gate_pass_id NULL means N/A. Vehicle in reading meaning/unit needs confirmation; PPE is free text pending checklist definition.
CREATE TABLE vehicle_weighing_movement_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    register_date date NOT NULL,
    vehicle_number varchar(50),
    vehicle_type varchar(100),
    driver_name varchar(200),
    mobile_number varchar(30),
    transport_name varchar(200),
    vehicle_document text,
    ppe text,
    driver_card_number varchar(100),
    in_at timestamptz,
    driver_in_signature text,
    vehicle_in_reading numeric(18,3),
    vehicle_in_reading_unit varchar(30),
    out_at timestamptz,
    driver_out_signature text,
    gate_pass_id int,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE truck_driver_training_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    register_date date NOT NULL,
    vehicle_number varchar(50),
    driver_name varchar(200),
    driver_signature text,
    safety_training text,
    training_imparted_by varchar(200),
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Listed under Gate 2 in the MoM, but explicitly maintained at Gate 1.
CREATE TABLE biw_in_out_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 1',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- GATE 2
CREATE TABLE associate_in_out_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE v5_contract_associate_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    work_area varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE visitors_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    name varchar(200),
    whom_to_meet varchar(200),
    coming_from varchar(200),
    contact_number varchar(30),
    purpose text,
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    laptop_details text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE driver_in_out_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    register_date date NOT NULL,
    vehicle_number varchar(50),
    driver_name varchar(200),
    mobile_number varchar(30),
    in_at timestamptz,
    out_at timestamptz,
    employee_count int CHECK (employee_count >= 0),
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE general_inward_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE nrgp_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rgp_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    initiator varchar(200),
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30) NOT NULL DEFAULT 'numbers',
    rgp_number varchar(100),
    authoriser_name varchar(200),
    receiver_signature text,
    security_signature_outward text,
    expected_date date,
    received_date date,
    security_signature_inward text,
    revised_tentative_return_date date,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sample_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    date_received date NOT NULL,
    sample_brought_by_name varchar(200),
    mobile_number varchar(30),
    supplier_name varchar(200),
    in_at timestamptz,
    security_name_at_receipt varchar(200),
    item_name varchar(200),
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    sample_receiver_name varchar(200),
    date_handed_over date,
    out_at timestamptz,
    receiver_signature text,
    security_name_at_handover varchar(200),
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE alcohol_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    test_date date NOT NULL,
    test_time time,
    vehicle_number_or_movement_details text,
    person_name varchar(200),
    test_outcome varchar(100),
    test_conducted_by_name varchar(200),
    supervisor_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trade_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    name varchar(200),
    whom_to_meet varchar(200),
    coming_from varchar(200),
    contact_number varchar(30),
    purpose text,
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    laptop_details text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sodexo_material_inward_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    document_type varchar(20) CHECK (document_type IN ('Invoice', 'DC')),
    document_number varchar(100),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE biw_material_inward_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scrap_outward_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    party_name varchar(200),
    description text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_unit varchar(30),
    invoice_number varchar(100),
    vehicle_number varchar(50),
    driver_signature text,
    security_signature text,
    remarks text,
    nrgp_number varchar(100),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE VIEW main_gate_vehicle_movement_car_registers AS
SELECT id, gate, serial_number, register_date, vehicle_number, driver_name,
       mobile_number, in_at, out_at, employee_count, remarks, recorded_by, created_at
FROM driver_in_out_registers;

CREATE TABLE vehicle_condition_forms (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    vehicle_number varchar(50),
    assessed_at timestamptz,
    vehicle_category varchar(50),
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_condition_responses (
    id serial PRIMARY KEY,
    form_id int NOT NULL REFERENCES vehicle_condition_forms(id),
    criterion text NOT NULL,
    response boolean,
    remarks text,
    assessment_category varchar(100),
    weight numeric(5,2) CHECK (weight BETWEEN 0 AND 100),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vendor_returnable_tools_slips (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    slip_number varchar(100),
    vendor_visit_id int,
    vendor_company_name varchar(200),
    register_date date NOT NULL,
    tools_brought_by_name varchar(200),
    tools_brought_by_signature text,
    tools_brought_by_date date,
    security_name_at_entry varchar(200),
    security_signature_at_entry text,
    security_date_at_entry date,
    tools_taken_by_name varchar(200),
    tools_taken_by_signature text,
    tools_taken_by_date date,
    security_name_at_exit varchar(200),
    security_signature_at_exit text,
    security_date_at_exit date,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vendor_returnable_tools_items (
    id serial PRIMARY KEY,
    slip_id int NOT NULL REFERENCES vendor_returnable_tools_slips(id),
    line_serial_number varchar(100),
    description_of_tools text,
    quantity numeric(18,3) CHECK (quantity >= 0),
    quantity_taken_out numeric(18,3) CHECK (quantity_taken_out >= 0),
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE key_movement_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    register_date date NOT NULL,
    taken_by_name varchar(200),
    taken_signature text,
    department varchar(200),
    key_name varchar(200),
    key_quantity_issued int CHECK (key_quantity_issued >= 0),
    time_out timestamptz,
    security_signature_at_issue text,
    deposit_by_name varchar(200),
    deposit_signature text,
    return_date date,
    key_quantity_returned int CHECK (key_quantity_returned >= 0),
    security_signature_at_return text,
    in_at timestamptz,
    remarks text,
    CHECK (in_at IS NULL OR time_out IS NULL OR in_at >= time_out),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roof_access_loto_keys_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    area varchar(200),
    equipment varchar(200),
    loto_number varchar(100),
    quantity_issued int CHECK (quantity_issued >= 0),
    work_details text,
    handover_to_associate varchar(200),
    associate_name_at_issue varchar(200),
    associate_signature_at_issue text,
    security_name_at_issue varchar(200),
    security_signature_at_issue text,
    return_date date,
    associate_name_at_return varchar(200),
    associate_signature_at_return text,
    quantity_returned int CHECK (quantity_returned >= 0),
    security_name_at_return varchar(200),
    security_signature_at_return text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE g4s_security_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    register_date date NOT NULL,
    clock_number varchar(100),
    name varchar(200),
    shift varchar(20) CHECK (shift IN ('A', 'B', 'C', 'General')),
    rank varchar(100),
    post varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE g4s_training_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    training_date date NOT NULL,
    site_name varchar(200),
    training_conducted_by varchar(200),
    trainer_designation varchar(100),
    start_at timestamptz,
    end_at timestamptz,
    topic text,
    trainer_signature text,
    security_acknowledgement text,
    number_of_security_trainees int CHECK (number_of_security_trainees >= 0),
    remarks text,
    CHECK (end_at IS NULL OR start_at IS NULL OR end_at >= start_at),
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE g4s_training_attendees (
    id serial PRIMARY KEY,
    training_id int NOT NULL REFERENCES g4s_training_registers(id),
    trainee_serial_number varchar(100),
    trainee_clock_or_id_number varchar(100),
    trainee_name varchar(200),
    trainee_designation varchar(100),
    trainee_signature text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE letter_entry_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    event_at timestamptz NOT NULL,
    coming_from varchar(200),
    to_whom varchar(200),
    brought_by varchar(200),
    quantity int CHECK (quantity >= 0),
    received_by_name varchar(200),
    received_by_signature text,
    signature text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE laundry_in_out_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    register_date date NOT NULL,
    dc_number varchar(100),
    vehicle_number_at_initial_movement varchar(50),
    coming_from varchar(200),
    description text,
    quantity_at_initial_movement numeric(18,3) CHECK (quantity_at_initial_movement >= 0),
    quantity_unit varchar(30),
    brought_by varchar(200),
    security_signature_at_initial_movement text,
    return_at timestamptz,
    vehicle_number_at_return varchar(50),
    taken_by varchar(200),
    quantity_at_return numeric(18,3) CHECK (quantity_at_return >= 0),
    security_signature_at_return text,
    remarks text,
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- GATE 3
CREATE TABLE biw_manpower_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 3',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    main_category varchar(100) DEFAULT 'BIW',
    subcategory varchar(100) DEFAULT 'BIW Manpower',
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kdl_manpower_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 3',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    main_category varchar(100) DEFAULT 'KDL',
    subcategory varchar(100) DEFAULT 'KDL Manpower',
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE swift_manpower_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 3',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    main_category varchar(100) DEFAULT 'KDL',
    subcategory varchar(100) DEFAULT 'Swift Manpower',
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gl_manpower_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 3',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    main_category varchar(100) DEFAULT 'KDL',
    subcategory varchar(100) DEFAULT 'GL Manpower',
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pci_staff_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 3',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    main_category varchar(100) DEFAULT 'Sodexo',
    subcategory varchar(100) DEFAULT 'PCI Staff',
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sodexo_staff_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 3',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    main_category varchar(100) DEFAULT 'Sodexo',
    subcategory varchar(100) DEFAULT 'Sodexo Staff',
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE canteen_registers (
    id serial PRIMARY KEY,
    gate varchar(50) NOT NULL DEFAULT 'Gate 2',
    serial_number varchar(100),
    register_date date NOT NULL,
    name varchar(200),
    in_at timestamptz,
    in_signature text,
    out_at timestamptz,
    out_signature text,
    remarks text,
    CHECK (out_at IS NULL OR in_at IS NULL OR out_at >= in_at),
    main_category varchar(100),
    subcategory varchar(100) DEFAULT 'Canteen',
    recorded_by int REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
