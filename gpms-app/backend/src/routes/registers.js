import { Router } from 'express'
import { query } from '../db.js'
import { authenticate, requirePermission as authorize } from '../lib/auth.js'
import { parse } from '../lib/http.js'
import { z } from '../lib/validators.js'

export const router = Router()

export const REGISTERS_META = [
  { gate: 'Gate 1', category: 'FG Outward', subcategory: 'FG Outward Register', table: 'fg_outward_registers' },
  { gate: 'Gate 1', category: 'Material', subcategory: 'Inward Raw Material', table: 'inward_raw_material_registers' },
  { gate: 'Gate 1', category: 'Material', subcategory: 'Sample Reject Material', table: 'sample_reject_material_registers' },
  { gate: 'Gate 1', category: 'Material', subcategory: 'Finished Product SRDC', table: 'finished_product_srdc_registers' },
  { gate: 'Gate 1', category: 'Material', subcategory: 'Finished Product NRDC', table: 'finished_product_nrdc_registers' },
  { gate: 'Gate 1', category: 'Material', subcategory: 'Bulk', table: 'bulk_registers' },
  { gate: 'Gate 1', category: 'Movement', subcategory: 'Main Gate Vehicle', table: 'main_gate_vehicle_movement_registers' },
  { gate: 'Gate 1', category: 'Movement', subcategory: 'Vehicle Weighing', table: 'vehicle_weighing_movement_registers' },
  { gate: 'Gate 1', category: 'Training', subcategory: 'Truck Driver Training', table: 'truck_driver_training_registers' },
  { gate: 'Gate 1', category: 'Manpower', subcategory: 'BIW In Out', table: 'biw_in_out_registers' },
  { gate: 'Gate 2', category: 'Manpower', subcategory: 'Associate In Out', table: 'associate_in_out_registers' },
  { gate: 'Gate 2', category: 'Manpower', subcategory: 'V5 Contract Associate', table: 'v5_contract_associate_registers' },
  { gate: 'Gate 2', category: 'Security', subcategory: 'Visitors', table: 'visitors_registers' },
  { gate: 'Gate 2', category: 'Movement', subcategory: 'Driver In Out', table: 'driver_in_out_registers' },
  { gate: 'Gate 2', category: 'Material', subcategory: 'General Inward', table: 'general_inward_registers' },
  { gate: 'Gate 2', category: 'Material', subcategory: 'NRGP', table: 'nrgp_registers' },
  { gate: 'Gate 2', category: 'Material', subcategory: 'RGP', table: 'rgp_registers' },
  { gate: 'Gate 2', category: 'Security', subcategory: 'Sample', table: 'sample_registers' },
  { gate: 'Gate 2', category: 'Security', subcategory: 'Alcohol Test', table: 'alcohol_registers' },
  { gate: 'Gate 2', category: 'Security', subcategory: 'Trade', table: 'trade_registers' },
  { gate: 'Gate 2', category: 'Material', subcategory: 'Sodexo Material Inward', table: 'sodexo_material_inward_registers' },
  { gate: 'Gate 2', category: 'Material', subcategory: 'BIW Material Inward', table: 'biw_material_inward_registers' },
  { gate: 'Gate 2', category: 'Material', subcategory: 'Scrap Outward', table: 'scrap_outward_registers' },
  { gate: 'Gate 2', category: 'Security', subcategory: 'Vehicle Condition Forms', table: 'vehicle_condition_forms' },
  { gate: 'Gate 2', category: 'Security', subcategory: 'Vendor Returnable Tools Slips', table: 'vendor_returnable_tools_slips' },
  { gate: 'Gate 2', category: 'Movement', subcategory: 'Key Movement', table: 'key_movement_registers' },
  { gate: 'Gate 2', category: 'Movement', subcategory: 'Roof Access LOTO Keys', table: 'roof_access_loto_keys_registers' },
  { gate: 'Gate 2', category: 'Security', subcategory: 'G4S Security', table: 'g4s_security_registers' },
  { gate: 'Gate 2', category: 'Training', subcategory: 'G4S Training', table: 'g4s_training_registers' },
  { gate: 'Gate 2', category: 'Misc', subcategory: 'Letter Entry', table: 'letter_entry_registers' },
  { gate: 'Gate 2', category: 'Movement', subcategory: 'Laundry In Out', table: 'laundry_in_out_registers' },
  { gate: 'Gate 3', category: 'Manpower', subcategory: 'BIW Manpower', table: 'biw_manpower_registers' },
  { gate: 'Gate 3', category: 'Manpower', subcategory: 'KDL Manpower', table: 'kdl_manpower_registers' },
  { gate: 'Gate 3', category: 'Manpower', subcategory: 'Swift Manpower', table: 'swift_manpower_registers' },
  { gate: 'Gate 3', category: 'Manpower', subcategory: 'GL Manpower', table: 'gl_manpower_registers' },
  { gate: 'Gate 3', category: 'Sodexo', subcategory: 'PCI Staff', table: 'pci_staff_registers' },
  { gate: 'Gate 3', category: 'Sodexo', subcategory: 'Sodexo Staff', table: 'sodexo_staff_registers' },
  { gate: 'Gate 2', category: 'Sodexo', subcategory: 'Canteen', table: 'canteen_registers' }
]

export const SCHEMA = {
  "fg_outward_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "inward_raw_material_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "sample_reject_material_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "coming_from",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "dc_number",
      "type": "varchar"
    },
    {
      "name": "to_whom",
      "type": "varchar"
    },
    {
      "name": "brought_by",
      "type": "varchar"
    },
    {
      "name": "security_signature",
      "type": "text"
    }
  ],
  "finished_product_srdc_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "finished_product_nrdc_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "bulk_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "main_gate_vehicle_movement_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "slip_number",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "gross_weight",
      "type": "numeric"
    },
    {
      "name": "tare_weight",
      "type": "numeric"
    },
    {
      "name": "net_weight",
      "type": "numeric"
    },
    {
      "name": "weight_unit",
      "type": "varchar"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    }
  ],
  "vehicle_weighing_movement_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_type",
      "type": "varchar"
    },
    {
      "name": "driver_name",
      "type": "varchar"
    },
    {
      "name": "mobile_number",
      "type": "varchar"
    },
    {
      "name": "transport_name",
      "type": "varchar"
    },
    {
      "name": "vehicle_document",
      "type": "text"
    },
    {
      "name": "ppe",
      "type": "text"
    },
    {
      "name": "driver_card_number",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "driver_in_signature",
      "type": "text"
    },
    {
      "name": "vehicle_in_reading",
      "type": "numeric"
    },
    {
      "name": "vehicle_in_reading_unit",
      "type": "varchar"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "driver_out_signature",
      "type": "text"
    },
    {
      "name": "gate_pass_id",
      "type": "int"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "truck_driver_training_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_name",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "safety_training",
      "type": "text"
    },
    {
      "name": "training_imparted_by",
      "type": "varchar"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "biw_in_out_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "associate_in_out_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "v5_contract_associate_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "work_area",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "visitors_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "whom_to_meet",
      "type": "varchar"
    },
    {
      "name": "coming_from",
      "type": "varchar"
    },
    {
      "name": "contact_number",
      "type": "varchar"
    },
    {
      "name": "purpose",
      "type": "text"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "laptop_details",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "driver_in_out_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_name",
      "type": "varchar"
    },
    {
      "name": "mobile_number",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "employee_count",
      "type": "int"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "general_inward_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "nrgp_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "rgp_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "initiator",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "rgp_number",
      "type": "varchar"
    },
    {
      "name": "authoriser_name",
      "type": "varchar"
    },
    {
      "name": "receiver_signature",
      "type": "text"
    },
    {
      "name": "security_signature_outward",
      "type": "text"
    },
    {
      "name": "expected_date",
      "type": "date"
    },
    {
      "name": "received_date",
      "type": "date"
    },
    {
      "name": "security_signature_inward",
      "type": "text"
    },
    {
      "name": "revised_tentative_return_date",
      "type": "date"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "sample_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "date_received",
      "type": "date"
    },
    {
      "name": "sample_brought_by_name",
      "type": "varchar"
    },
    {
      "name": "mobile_number",
      "type": "varchar"
    },
    {
      "name": "supplier_name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "security_name_at_receipt",
      "type": "varchar"
    },
    {
      "name": "item_name",
      "type": "varchar"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "sample_receiver_name",
      "type": "varchar"
    },
    {
      "name": "date_handed_over",
      "type": "date"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "receiver_signature",
      "type": "text"
    },
    {
      "name": "security_name_at_handover",
      "type": "varchar"
    }
  ],
  "alcohol_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "test_date",
      "type": "date"
    },
    {
      "name": "test_time",
      "type": "time"
    },
    {
      "name": "vehicle_number_or_movement_details",
      "type": "text"
    },
    {
      "name": "person_name",
      "type": "varchar"
    },
    {
      "name": "test_outcome",
      "type": "varchar"
    },
    {
      "name": "test_conducted_by_name",
      "type": "varchar"
    },
    {
      "name": "supervisor_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "trade_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "whom_to_meet",
      "type": "varchar"
    },
    {
      "name": "coming_from",
      "type": "varchar"
    },
    {
      "name": "contact_number",
      "type": "varchar"
    },
    {
      "name": "purpose",
      "type": "text"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "laptop_details",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "sodexo_material_inward_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "document_type",
      "type": "varchar"
    },
    {
      "name": "document_number",
      "type": "varchar"
    }
  ],
  "biw_material_inward_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "scrap_outward_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "party_name",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "invoice_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "driver_signature",
      "type": "text"
    },
    {
      "name": "security_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "nrgp_number",
      "type": "varchar"
    }
  ],
  "vehicle_condition_forms": [
    {
      "name": "vehicle_number",
      "type": "varchar"
    },
    {
      "name": "assessed_at",
      "type": "timestamptz"
    },
    {
      "name": "vehicle_category",
      "type": "varchar"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "vehicle_condition_responses": [
    {
      "name": "form_id",
      "type": "int"
    },
    {
      "name": "criterion",
      "type": "text"
    },
    {
      "name": "response",
      "type": "boolean"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "assessment_category",
      "type": "varchar"
    },
    {
      "name": "weight",
      "type": "numeric"
    }
  ],
  "vendor_returnable_tools_slips": [
    {
      "name": "slip_number",
      "type": "varchar"
    },
    {
      "name": "vendor_visit_id",
      "type": "int"
    },
    {
      "name": "vendor_company_name",
      "type": "varchar"
    },
    {
      "name": "tools_brought_by_name",
      "type": "varchar"
    },
    {
      "name": "tools_brought_by_signature",
      "type": "text"
    },
    {
      "name": "tools_brought_by_date",
      "type": "date"
    },
    {
      "name": "security_name_at_entry",
      "type": "varchar"
    },
    {
      "name": "security_signature_at_entry",
      "type": "text"
    },
    {
      "name": "security_date_at_entry",
      "type": "date"
    },
    {
      "name": "tools_taken_by_name",
      "type": "varchar"
    },
    {
      "name": "tools_taken_by_signature",
      "type": "text"
    },
    {
      "name": "tools_taken_by_date",
      "type": "date"
    },
    {
      "name": "security_name_at_exit",
      "type": "varchar"
    },
    {
      "name": "security_signature_at_exit",
      "type": "text"
    },
    {
      "name": "security_date_at_exit",
      "type": "date"
    }
  ],
  "vendor_returnable_tools_items": [
    {
      "name": "slip_id",
      "type": "int"
    },
    {
      "name": "line_serial_number",
      "type": "varchar"
    },
    {
      "name": "description_of_tools",
      "type": "text"
    },
    {
      "name": "quantity",
      "type": "numeric"
    },
    {
      "name": "quantity_taken_out",
      "type": "numeric"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "key_movement_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "taken_by_name",
      "type": "varchar"
    },
    {
      "name": "taken_signature",
      "type": "text"
    },
    {
      "name": "department",
      "type": "varchar"
    },
    {
      "name": "key_name",
      "type": "varchar"
    },
    {
      "name": "key_quantity_issued",
      "type": "int"
    },
    {
      "name": "time_out",
      "type": "timestamptz"
    },
    {
      "name": "security_signature_at_issue",
      "type": "text"
    },
    {
      "name": "deposit_by_name",
      "type": "varchar"
    },
    {
      "name": "deposit_signature",
      "type": "text"
    },
    {
      "name": "return_date",
      "type": "date"
    },
    {
      "name": "key_quantity_returned",
      "type": "int"
    },
    {
      "name": "security_signature_at_return",
      "type": "text"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "roof_access_loto_keys_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "area",
      "type": "varchar"
    },
    {
      "name": "equipment",
      "type": "varchar"
    },
    {
      "name": "loto_number",
      "type": "varchar"
    },
    {
      "name": "quantity_issued",
      "type": "int"
    },
    {
      "name": "work_details",
      "type": "text"
    },
    {
      "name": "handover_to_associate",
      "type": "varchar"
    },
    {
      "name": "associate_name_at_issue",
      "type": "varchar"
    },
    {
      "name": "associate_signature_at_issue",
      "type": "text"
    },
    {
      "name": "security_name_at_issue",
      "type": "varchar"
    },
    {
      "name": "security_signature_at_issue",
      "type": "text"
    },
    {
      "name": "return_date",
      "type": "date"
    },
    {
      "name": "associate_name_at_return",
      "type": "varchar"
    },
    {
      "name": "associate_signature_at_return",
      "type": "text"
    },
    {
      "name": "quantity_returned",
      "type": "int"
    },
    {
      "name": "security_name_at_return",
      "type": "varchar"
    },
    {
      "name": "security_signature_at_return",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "g4s_security_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "clock_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "shift",
      "type": "varchar"
    },
    {
      "name": "rank",
      "type": "varchar"
    },
    {
      "name": "post",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    }
  ],
  "g4s_training_registers": [
    {
      "name": "training_date",
      "type": "date"
    },
    {
      "name": "site_name",
      "type": "varchar"
    },
    {
      "name": "training_conducted_by",
      "type": "varchar"
    },
    {
      "name": "trainer_designation",
      "type": "varchar"
    },
    {
      "name": "start_at",
      "type": "timestamptz"
    },
    {
      "name": "end_at",
      "type": "timestamptz"
    },
    {
      "name": "topic",
      "type": "text"
    },
    {
      "name": "trainer_signature",
      "type": "text"
    },
    {
      "name": "security_acknowledgement",
      "type": "text"
    },
    {
      "name": "number_of_security_trainees",
      "type": "int"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "g4s_training_attendees": [
    {
      "name": "training_id",
      "type": "int"
    },
    {
      "name": "trainee_serial_number",
      "type": "varchar"
    },
    {
      "name": "trainee_clock_or_id_number",
      "type": "varchar"
    },
    {
      "name": "trainee_name",
      "type": "varchar"
    },
    {
      "name": "trainee_designation",
      "type": "varchar"
    },
    {
      "name": "trainee_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "letter_entry_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "coming_from",
      "type": "varchar"
    },
    {
      "name": "to_whom",
      "type": "varchar"
    },
    {
      "name": "brought_by",
      "type": "varchar"
    },
    {
      "name": "quantity",
      "type": "int"
    },
    {
      "name": "received_by_name",
      "type": "varchar"
    },
    {
      "name": "received_by_signature",
      "type": "text"
    },
    {
      "name": "signature",
      "type": "text"
    }
  ],
  "laundry_in_out_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "dc_number",
      "type": "varchar"
    },
    {
      "name": "vehicle_number_at_initial_movement",
      "type": "varchar"
    },
    {
      "name": "coming_from",
      "type": "varchar"
    },
    {
      "name": "description",
      "type": "text"
    },
    {
      "name": "quantity_at_initial_movement",
      "type": "numeric"
    },
    {
      "name": "quantity_unit",
      "type": "varchar"
    },
    {
      "name": "brought_by",
      "type": "varchar"
    },
    {
      "name": "security_signature_at_initial_movement",
      "type": "text"
    },
    {
      "name": "return_at",
      "type": "timestamptz"
    },
    {
      "name": "vehicle_number_at_return",
      "type": "varchar"
    },
    {
      "name": "taken_by",
      "type": "varchar"
    },
    {
      "name": "quantity_at_return",
      "type": "numeric"
    },
    {
      "name": "security_signature_at_return",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    }
  ],
  "biw_manpower_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "main_category",
      "type": "varchar"
    },
    {
      "name": "subcategory",
      "type": "varchar"
    }
  ],
  "kdl_manpower_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "main_category",
      "type": "varchar"
    },
    {
      "name": "subcategory",
      "type": "varchar"
    }
  ],
  "swift_manpower_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "main_category",
      "type": "varchar"
    },
    {
      "name": "subcategory",
      "type": "varchar"
    }
  ],
  "gl_manpower_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "main_category",
      "type": "varchar"
    },
    {
      "name": "subcategory",
      "type": "varchar"
    }
  ],
  "pci_staff_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "main_category",
      "type": "varchar"
    },
    {
      "name": "subcategory",
      "type": "varchar"
    }
  ],
  "sodexo_staff_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "main_category",
      "type": "varchar"
    },
    {
      "name": "subcategory",
      "type": "varchar"
    }
  ],
  "canteen_registers": [
    {
      "name": "serial_number",
      "type": "varchar"
    },
    {
      "name": "name",
      "type": "varchar"
    },
    {
      "name": "in_at",
      "type": "timestamptz"
    },
    {
      "name": "in_signature",
      "type": "text"
    },
    {
      "name": "out_at",
      "type": "timestamptz"
    },
    {
      "name": "out_signature",
      "type": "text"
    },
    {
      "name": "remarks",
      "type": "text"
    },
    {
      "name": "main_category",
      "type": "varchar"
    },
    {
      "name": "subcategory",
      "type": "varchar"
    }
  ]
}

// meta route moved

router.use(authenticate)


router.get('/', authorize('gate_registers'), async (req, res) => {
  const q = parse(
    z.object({
      gate: z.string().optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).default(50),
    }),
    req.query,
  )

  const where = []
  const params = []
  const add = (sql, v) => (params.push(v), where.push(sql.replace('?', `$${params.length}`)))

  if (q.gate) add('gate = ?', q.gate)

  const meta = REGISTERS_META.find(r => r.subcategory === q.subcategory)
  if (!meta) return res.json({ data: [] })

  const tableName = meta.table

  const { rows } = await query(
    `SELECT * FROM ${tableName} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT ${q.limit}`,
    params,
  )
  res.json({ data: rows })
})

router.post('/', authorize('gate_registers'), async (req, res) => {
  const { gate, category, subcategory, ...fields } = req.body
  if (!gate || !category || !subcategory) return res.status(400).json({ error: 'Missing gate/category/subcategory' })

  const meta = REGISTERS_META.find(r => r.gate === gate && r.category === category && r.subcategory === subcategory)
  if (!meta) return res.status(400).json({ error: 'Unknown register' })

  const tableSchema = SCHEMA[meta.table]
  if (!tableSchema) return res.status(400).json({ error: 'Schema not found' })

  const insertFields = ['gate', 'recorded_by']
  const insertParams = [gate, req.user.id]
  let paramIndex = 3

  for (const col of tableSchema) {
    if (fields[col.name] !== undefined && fields[col.name] !== '') {
      insertFields.push(col.name)
      insertParams.push(fields[col.name])
    }
  }

  // add hardcoded event_at or register_date if they exist in DB schema but aren't filled
  // well, some tables use event_at, some use register_date
  // Let's just blindly insert them if they don't have defaults, wait Postgres will use defaults or throw.
  // Actually, event_at / register_date are NOT NULL without DEFAULT in 005. Let's add them.
  if (code.includes('event_at timestamptz NOT NULL')) {
     // We can just rely on the fact that if a table has event_at, it should be set to now()
  }

  try {
    // Check if table has event_at or register_date by reading SCHEMA keys? No, SCHEMA excludes them.
    // Let's just do a generic check via query
    const { rows: cols } = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [meta.table]);
    const colNames = cols.map(c => c.column_name);
    if (colNames.includes('event_at') && !insertFields.includes('event_at')) {
      insertFields.push('event_at');
      insertParams.push(new Date());
    }
    if (colNames.includes('register_date') && !insertFields.includes('register_date')) {
      insertFields.push('register_date');
      insertParams.push(new Date());
    }
    if (colNames.includes('in_at') && !insertFields.includes('in_at')) {
      insertFields.push('in_at');
      insertParams.push(new Date());
    }

    const valuesStr = insertParams.map((_, i) => `$${i + 1}`).join(', ')
    const { rows } = await query(
      `INSERT INTO ${meta.table} (${insertFields.join(', ')}) VALUES (${valuesStr}) RETURNING *`,
      insertParams
    )
    return res.status(201).json(rows[0])
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message })
  }
})

router.post('/:id/checkout', authorize('gate_registers'), async (req, res) => {
  const { subcategory } = req.body
  const meta = REGISTERS_META.find(r => r.subcategory === subcategory)
  if (!meta) return res.status(400).json({ error: 'Unknown register' })

  const { rows } = await query(`UPDATE ${meta.table} SET out_at = now() WHERE id = $1 AND out_at IS NULL RETURNING *`, [req.params.id])
  if (!rows.length) return res.status(404).json({ error: 'Record not found or already checked out' })
  res.json(rows[0])
})

router.get('/meta', (req, res, next) => { console.log('META PRE-HANDLER', req.path); next(); });
router.get('/meta', authorize('gate_registers'), (req, res) => {
  console.log('HIT META'); res.json({ registers: REGISTERS_META, schema: SCHEMA })
})
console.log('RESTARTING NODEMON');
