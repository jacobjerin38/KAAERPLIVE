// 216 Stock Items from Tally Records ('Opening Stock 1 Aug 2026.xlsx')
// Total Valuation: QAR 2,769,488.60 | Total Quantity: 40,140 Units
export interface InventoryStockItem {
    item_code: string;
    item_name: string;
    category: string;
    uom: string;
    quantity: number;
    unit_cost: number;
    total_value: number;
    warehouse: string;
}

export const PEC_OPENING_STOCK_ITEMS: InventoryStockItem[] = [
  {
    "item_code": "3X SP1",
    "item_name": "3X Spatula",
    "category": "3X Bobipreg & Consumables",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 10.49,
    "total_value": 104.91,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3XF3X8 1",
    "item_name": "F3X8 - 1kg",
    "category": "3X Fillers & Primers",
    "uom": "SET",
    "quantity": 5,
    "unit_cost": 1353.07,
    "total_value": 6765.36,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3XF3X8 250",
    "item_name": "F3X8 - 250g",
    "category": "3X Fillers & Primers",
    "uom": "SET",
    "quantity": 2,
    "unit_cost": 467.05,
    "total_value": 934.1,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X BB-BB-033-05 pcs/pk",
    "item_name": "BB-BB-033-05 pcs/pk",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 41,
    "unit_cost": 112.69,
    "total_value": 4620.49,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X BB-BB-033-10 pcs/pk",
    "item_name": "BB-BB-033-10 pcs/pk",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 154,
    "unit_cost": 126.73,
    "total_value": 19516.72,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X BB-BB-102-10 pcs/pk",
    "item_name": "BB-BB-102-10 pcs/pk",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 20,
    "unit_cost": 145.79,
    "total_value": 2915.7,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X BB-BB-103-10 pcs/pk",
    "item_name": "BB-BB-103-10 pcs/pk",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 57,
    "unit_cost": 123.52,
    "total_value": 7040.66,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X KEV 25/300 - 8020",
    "item_name": "KEV 25/300 - 8020",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3961.57,
    "total_value": 3961.57,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X KEV 50/100 - 8020",
    "item_name": "KEV 50/100 - 8020",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 7,
    "unit_cost": 2047.5,
    "total_value": 14332.47,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X KEV 50/25 - 8020",
    "item_name": "KEV 50/25 - 8020",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1933.99,
    "total_value": 3867.98,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X R3X110 Resin 1.04kg",
    "item_name": "R3X110 Resin 1.04kg",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 293.46,
    "total_value": 586.92,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X R3X95 resin 1.3kg",
    "item_name": "R3X95 resin 1.3kg",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 26,
    "unit_cost": 407.76,
    "total_value": 10601.77,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X R4D-ECTHT 25/300 kit",
    "item_name": "R4D-ECTHT 25/300 kit",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 5531.03,
    "total_value": 5531.03,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X R4D-ECTHT 50/100 kit",
    "item_name": "R4D-ECTHT 50/100 kit",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 17,
    "unit_cost": 3751.41,
    "total_value": 63774.03,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X R4D-S 50/100 kit",
    "item_name": "R4D-S 50/100 kit",
    "category": "3X Reinforcekit 4D",
    "uom": "PCS",
    "quantity": 25,
    "unit_cost": 9115.15,
    "total_value": 227878.65,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X F3X8 Dispensing Gun",
    "item_name": "F3X8 Dispensing Gun",
    "category": "3X Rollerkit",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 914.53,
    "total_value": 914.53,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X FIXoKIT",
    "item_name": "FIXoKIT",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 5,
    "unit_cost": 3421.48,
    "total_value": 17107.42,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STOF002",
    "item_name": "STOF002 60.3mm/2.38\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 2307.62,
    "total_value": 2307.62,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STOF004",
    "item_name": "STOF004 114mm/4.5\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 2799.99,
    "total_value": 5599.98,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STOF020",
    "item_name": "STOF020 508mm/20\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 5949.17,
    "total_value": 11898.34,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON002",
    "item_name": "STON002 60.3mm/2.38\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 4,
    "unit_cost": 1197.59,
    "total_value": 4790.35,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON004",
    "item_name": "STON004 114mm/4.5\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 4,
    "unit_cost": 1894.59,
    "total_value": 7578.37,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON006",
    "item_name": "STON006 168mm/6.625\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 2365.45,
    "total_value": 23654.49,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON010",
    "item_name": "STON010 273mm/10.75\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 3347.68,
    "total_value": 10043.03,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON012",
    "item_name": "STON012 324mm/12.75\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 3528.52,
    "total_value": 10585.56,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON016",
    "item_name": "STON016 406mm/16\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 4,
    "unit_cost": 3777.13,
    "total_value": 15108.5,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON018",
    "item_name": "STON018 457mm/18\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3501.87,
    "total_value": 3501.87,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "3X STON020",
    "item_name": "STON020 508mm/20\"",
    "category": "3X Stopkit",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3535.71,
    "total_value": 3535.71,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "086180 OLD",
    "item_name": "ARC 10 250g (QP) EXPIRED",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 118.51,
    "total_value": 1185.1,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "086180 ",
    "item_name": "ARC 10 QP Gray 250G",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 30,
    "unit_cost": 187.01,
    "total_value": 5610.35,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-ARC-ARC-5-250G-QP-EXPIRED",
    "item_name": "ARC 5 250g (QP) EXPIRED",
    "category": "CH ARC Industrial Coatings",
    "uom": "SET",
    "quantity": 8,
    "unit_cost": 710.43,
    "total_value": 5683.41,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "086674",
    "item_name": "ARC 5ES 114g Stick EXPIRED",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 8,
    "unit_cost": 61.24,
    "total_value": 489.92,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "081667",
    "item_name": "ARC 5 QP 250G",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 19,
    "unit_cost": 191.36,
    "total_value": 3635.85,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH ARC 791",
    "item_name": "ARC 791(E) Resin Pack Gray (791 System Kit)",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 1271.42,
    "total_value": 12714.22,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "082204",
    "item_name": "ARC 791 Resin Pack EXPIRED",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 6,
    "unit_cost": 1055.06,
    "total_value": 6330.35,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH ARC 797- 791",
    "item_name": "ARC 797(E) Prim Pack (791 System Kit)",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 471.38,
    "total_value": 4713.84,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH ARC 797- 988",
    "item_name": "ARC 797(E) PTA & PTB (988 System Kit)",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 1444.2,
    "total_value": 4332.61,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "082206",
    "item_name": "ARC 797 Primer Pack EXPIRED",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 14,
    "unit_cost": 399.23,
    "total_value": 5589.16,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "085404EU",
    "item_name": "ARC 858(E) Gray 16 Ltr",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 16,
    "unit_cost": 6602.57,
    "total_value": 105641.13,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH ARC 988",
    "item_name": "ARC 988(E) Red Bulk Kit (988 System Kit)",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 6514.88,
    "total_value": 19544.64,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "082205",
    "item_name": "ARC 988 Resin Pack EXPIRED",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 2608,
    "total_value": 7824,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "250590",
    "item_name": "ARC Agg vert PT",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 19,
    "unit_cost": 161.25,
    "total_value": 3063.8,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "84766",
    "item_name": "ARC BX1 (890) 20KG EXPIRED",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 5,
    "unit_cost": 1452.9,
    "total_value": 7264.5,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH ARC BX1",
    "item_name": "ARC BX1(E) 12x20KG",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 12,
    "unit_cost": 2010.59,
    "total_value": 24127.04,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "082743EU ",
    "item_name": "ARC HT-S(E) Gray 16 Ltr",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 73,
    "unit_cost": 7914.04,
    "total_value": 577725.13,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH ARC HT-T",
    "item_name": "ARC HT-T(E) Black 5 Ltr",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3602.05,
    "total_value": 3602.05,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "082053EU 791",
    "item_name": "ARC QRV(E) / AGG(E) Vert PT C 16.3kg (791 System Ki",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 30,
    "unit_cost": 199.69,
    "total_value": 5990.7,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "082053EU 988",
    "item_name": "ARC QRV(E) / AGG(E) Vert PT C 16.3kg (988 System Ki",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 36,
    "unit_cost": 201.1,
    "total_value": 7239.55,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "85407",
    "item_name": "ARC S2 Gray 16L",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 12,
    "unit_cost": 5968.77,
    "total_value": 71625.27,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "84497",
    "item_name": "ARC S4 1125ml Cartridge",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 7,
    "unit_cost": 453.39,
    "total_value": 3173.73,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "84177",
    "item_name": "ARC S4 (A&B) 16 Ltr",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 17,
    "unit_cost": 7297.4,
    "total_value": 124055.88,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "85807",
    "item_name": "ARC S5 System Kit 16L",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 5,
    "unit_cost": 7730.42,
    "total_value": 38652.11,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH ARC SD4I",
    "item_name": "ARC SD4I(E) System Kit 16 Ltr Gray",
    "category": "CH ARC Industrial Coatings",
    "uom": "PCS",
    "quantity": 6,
    "unit_cost": 7267.95,
    "total_value": 43607.69,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-273-AEROSOL-397G",
    "item_name": "273 Aerosol 397g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 65,
    "total_value": 650,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-276-20-LITERS",
    "item_name": "276 (20 Liters)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "CAN",
    "quantity": 42,
    "unit_cost": 853.58,
    "total_value": 35850.36,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-277-AEROSOL-250G",
    "item_name": "277 Aerosol 250g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 21,
    "unit_cost": 69.33,
    "total_value": 1455.98,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-294-AEROSOL-397G",
    "item_name": "294 Aerosol 397g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 55,
    "unit_cost": 35.58,
    "total_value": 1956.71,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-296-AEROSOL-250G",
    "item_name": "296 Aerosol 250g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 83.72,
    "total_value": 837.19,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-3500-5-32-X-35",
    "item_name": "3500 5/32\" x 35'",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 8,
    "unit_cost": 200,
    "total_value": 1600,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-3500-7-32-X-15",
    "item_name": "3500 7/32\" x 15'",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 9,
    "unit_cost": 150,
    "total_value": 1350,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-3500-9-32-X-9",
    "item_name": "3500 9/32\" x 9'",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 8,
    "unit_cost": 180,
    "total_value": 1440,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-438-AEROSOL-350G",
    "item_name": "438 Aerosol 350g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 5,
    "unit_cost": 135,
    "total_value": 675,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-601-20-LITERS",
    "item_name": "601 (20 Liters)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "CAN",
    "quantity": 11,
    "unit_cost": 747.57,
    "total_value": 8223.27,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-601-AEROSOL-350G",
    "item_name": "601 Aerosol 350g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 30,
    "unit_cost": 50,
    "total_value": 1500,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-615-HTG-2-400G",
    "item_name": "615 HTG #2 400g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "SET",
    "quantity": 17,
    "unit_cost": 124.42,
    "total_value": 2115.17,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-622-400G",
    "item_name": "622 400g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 9,
    "unit_cost": 100,
    "total_value": 900,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-651-20-LITERS",
    "item_name": "651 (20 Liters)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "CAN",
    "quantity": 1,
    "unit_cost": 677,
    "total_value": 677,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-660-AEROSOL-275G",
    "item_name": "660 Aerosol 275g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 100,
    "total_value": 1000,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-715-AEROSOL-350G",
    "item_name": "715 Aerosol 350g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 27,
    "unit_cost": 64.08,
    "total_value": 1730.16,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-723-AEROSOL-350G",
    "item_name": "723 Aerosol 350g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 118,
    "unit_cost": 48.78,
    "total_value": 5756.57,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-725-AEROSOL-350G",
    "item_name": "725 Aerosol 350g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 41,
    "unit_cost": 302.14,
    "total_value": 12387.74,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-725-BRUSH-TOP-500G",
    "item_name": "725 Brush Top 500g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 114,
    "unit_cost": 275.99,
    "total_value": 31462.41,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-730-AEROSOL-320G",
    "item_name": "730 Aerosol 320g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 82,
    "unit_cost": 128.73,
    "total_value": 10556.1,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-772-BRUSH-TOP-500G",
    "item_name": "772 Brush Top 500g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 27,
    "unit_cost": 283.32,
    "total_value": 7649.72,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-775-20-LITERS",
    "item_name": "775 (20 Liters)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "CAN",
    "quantity": 1,
    "unit_cost": 1220,
    "total_value": 1220,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-775-AEROSOL-350G",
    "item_name": "775 Aerosol 350g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 11,
    "unit_cost": 65,
    "total_value": 715,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-783-ACR-BRSHTOP-500G",
    "item_name": "783 ACR BrshTop 500g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 20,
    "unit_cost": 148.94,
    "total_value": 2978.79,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-785-BRUSH-TOP-500G",
    "item_name": "785 Brush Top 500g",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 260.17,
    "total_value": 2601.74,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-800-12-7MMX4-57M",
    "item_name": "800 (12.7mmx4.57m)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 76,
    "unit_cost": 16.48,
    "total_value": 1252.12,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-800-19-1MMX13-72M",
    "item_name": "800 (19.1mmx13.72m)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 62.49,
    "total_value": 624.94,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-800-25-4MMX13-72M",
    "item_name": "800 (25.4mmx13.72m)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 16,
    "unit_cost": 84.14,
    "total_value": 1346.2,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-800-6-4MMX13-72M",
    "item_name": "800 (6.4mmx13.72m)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 9,
    "unit_cost": 34.86,
    "total_value": 313.71,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "090379EU",
    "item_name": "803 (20 Liters)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 20,
    "unit_cost": 605.23,
    "total_value": 12104.6,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "082260EU",
    "item_name": "820 (20 Liters)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 13,
    "unit_cost": 885.32,
    "total_value": 11509.16,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-860-POLYMER-GASKET-KIT",
    "item_name": "860 Polymer Gasket Kit",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "KIT",
    "quantity": 6,
    "unit_cost": 1481.52,
    "total_value": 8889.1,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-900-GOLD-PASTE-200-G",
    "item_name": "900 Gold Paste (200 g)",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 12,
    "unit_cost": 109.76,
    "total_value": 1317.07,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-LUB-LUBRI-CUP-NPT-THREAD",
    "item_name": "Lubri-cup NPT Thread",
    "category": "CH Industrial Lubricants & MRO Chemicals",
    "uom": "PCS",
    "quantity": 6,
    "unit_cost": 105.14,
    "total_value": 630.83,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-119-DIAG-1-8X36-X12Y",
    "item_name": "119 Diag 1/8x36\"x12Y",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "SET",
    "quantity": 1,
    "unit_cost": 5269.21,
    "total_value": 5269.21,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400-12-0MM-5LB",
    "item_name": "1400 (12.0mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 2264,
    "total_value": 2264,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-10-0MM-2LB",
    "item_name": "1400R (10.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 4,
    "unit_cost": 911.66,
    "total_value": 3646.62,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-11-1MM-2LB",
    "item_name": "1400R (11.1mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 920.18,
    "total_value": 2760.54,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-12-0MM-2LB",
    "item_name": "1400R (12.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 5,
    "unit_cost": 933.87,
    "total_value": 4669.36,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-14-3MM-5LB",
    "item_name": "1400R (14.3mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 2280.33,
    "total_value": 4560.65,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-17-5MM-7LB",
    "item_name": "1400R (17.5mm) 7LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 3229.91,
    "total_value": 9689.72,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-22-2MM-7LB",
    "item_name": "1400R (22.2mm) 7LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 4862.95,
    "total_value": 4862.95,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-4-8MM-2LB",
    "item_name": "1400R ( 4.8mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 886.08,
    "total_value": 886.08,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1400R-6-4MM-2LB",
    "item_name": "1400R ( 6.4mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1143.62,
    "total_value": 2287.24,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1600-10-0MM-2LB",
    "item_name": "1600 (10.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1542.4,
    "total_value": 1542.4,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1600-12-7MM-2LB",
    "item_name": "1600 (12.7mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1292.47,
    "total_value": 2584.94,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1600-4-8MM-2LB",
    "item_name": "1600 ( 4.8mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 1336.26,
    "total_value": 4008.79,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1600CR-89-98X14-27MM",
    "item_name": "1600CR 89.98x14.27mm",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 157.38,
    "total_value": 314.75,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1622-3-2MM-1LB",
    "item_name": "1622 ( 3.2mm) 1LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 565,
    "total_value": 565,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1622-4-8MM-2LB",
    "item_name": "1622 ( 4.8mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1132,
    "total_value": 1132,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1724-10-0MM-2LB",
    "item_name": "1724 (10.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1419.77,
    "total_value": 1419.77,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1724-12-0MM-2LB",
    "item_name": "1724 (12.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1419.77,
    "total_value": 1419.77,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1724-12-7MM-2LB",
    "item_name": "1724 (12.7mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1653.41,
    "total_value": 1653.41,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1724-3-2MM-2LB",
    "item_name": "1724 ( 3.2mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1626.88,
    "total_value": 3253.76,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1724-6-0MM-2LB",
    "item_name": "1724 ( 6.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1419.76,
    "total_value": 1419.76,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1724-6-4MM-2LB",
    "item_name": "1724 ( 6.4mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1555.01,
    "total_value": 1555.01,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1724-7-9MM-2LB",
    "item_name": "1724 ( 7.9mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1285.41,
    "total_value": 1285.41,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1727-12-0MM-5LB",
    "item_name": "1727 (12.0mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 2500,
    "total_value": 2500,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1727-12-7MM-10LB",
    "item_name": "1727 (12.7mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 5000,
    "total_value": 5000,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1727-7-9MM-2LB",
    "item_name": "1727 ( 7.9mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1000,
    "total_value": 1000,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1730-11-1MM-5LB",
    "item_name": "1730 (11.1mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 2750,
    "total_value": 2750,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1730-12-7MM-5LB",
    "item_name": "1730 (12.7mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1710.99,
    "total_value": 1710.99,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1730-20-6MM-10LB",
    "item_name": "1730 (20.6mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 2978,
    "total_value": 2978,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1740-12-0MM-2LB",
    "item_name": "1740 (12.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 699.18,
    "total_value": 699.18,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1740-12-7MM-2LB",
    "item_name": "1740 (12.7mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1305.9,
    "total_value": 1305.9,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1740-16-0MM-10LB",
    "item_name": "1740 (16.0mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 5590.17,
    "total_value": 5590.17,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1760-10-0MM-5LB",
    "item_name": "1760 (10.0mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 2750,
    "total_value": 2750,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1761-11-1MM-5LB",
    "item_name": "1761 (11.1mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3400,
    "total_value": 3400,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1765-19-1MM-10LB",
    "item_name": "1765 (19.1mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 6540.8,
    "total_value": 6540.8,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1830-10-0MM-2LB",
    "item_name": "1830 (10.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 513.12,
    "total_value": 513.12,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1830-12-0MM-2LB",
    "item_name": "1830 (12.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 508.77,
    "total_value": 508.77,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1830-15-9MM-10LB",
    "item_name": "1830 (15.9mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1962.62,
    "total_value": 1962.62,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1830-22-2MM-10LB",
    "item_name": "1830 (22.2mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1962.62,
    "total_value": 1962.62,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-1830-8-0MM-2LB",
    "item_name": "1830 ( 8.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 508.77,
    "total_value": 508.77,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-1-X-75-25-4MMX23M",
    "item_name": "185 1\" x 75' (25.4mmx23M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 4887.02,
    "total_value": 9774.04,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-1-2-X-15-12MMX4-5M",
    "item_name": "185 1/2\" x 15' (12mmx4.5M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 316.23,
    "total_value": 316.23,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-1-4-X-50-7MMX15M",
    "item_name": "185 1/4\" x 50' (7mmx15M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 296,
    "total_value": 592,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-3-16-X75-5MMX23M",
    "item_name": "185 3/16\" x75' (5mmx23M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 296,
    "total_value": 296,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-3-4-X-30-20MMX9-14M",
    "item_name": "185 3/4\" x 30' (20mmx9.14M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 593,
    "total_value": 593,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-3-8-X-25-10MMX7-5M",
    "item_name": "185 3/8\" x 25' (10mmx7.5M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 1800,
    "total_value": 5400,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-3-8-X-50-10MMX15M",
    "item_name": "185 3/8\" x 50' (10mmx15M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 593,
    "total_value": 1186,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-5-8-X-15-17MMX4-5M",
    "item_name": "185 5/8\" x 15' (17mmx4.5M)",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 600,
    "total_value": 1200,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-185-JOINT-SEALANT-KIT",
    "item_name": "185 Joint Sealant Kit",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "KIT",
    "quantity": 3,
    "unit_cost": 1743.62,
    "total_value": 5230.86,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-10-0MM-2LB",
    "item_name": "412-W (10.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 434.42,
    "total_value": 1303.26,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-12-0MM-5LB",
    "item_name": "412-W (12.0mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 5,
    "unit_cost": 926.33,
    "total_value": 4631.67,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-14-3MM-5LB",
    "item_name": "412-W (14.3mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 770.69,
    "total_value": 2312.07,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-15-9MM-10LB",
    "item_name": "412-W (15.9mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1654.05,
    "total_value": 3308.09,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-19-1MM-10LB",
    "item_name": "412-W (19.1mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 1545.04,
    "total_value": 4635.12,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-7-9MM-2LB",
    "item_name": "412-W ( 7.9mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 379.87,
    "total_value": 379.87,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-7-9MM-5LB",
    "item_name": "412-W ( 7.9mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1108.29,
    "total_value": 1108.29,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-412-W-9-5MM-5LB",
    "item_name": "412-W ( 9.5mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 770.71,
    "total_value": 770.71,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-455-3-32-X-60-X60",
    "item_name": "455 3/32\" x 60\" x60\"",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1294.83,
    "total_value": 1294.83,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-459-1-8-X-39-X39",
    "item_name": "459 1/8\" x 39\" x39\"",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1222.26,
    "total_value": 2444.52,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-477-1-12-0MM-2LB",
    "item_name": "477-1 (12.0mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 789.5,
    "total_value": 789.5,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-477-1-12-7MM-2LB",
    "item_name": "477-1 (12.7mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1146.25,
    "total_value": 2292.49,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-477-1-14-3MM-5LB",
    "item_name": "477-1 (14.3mm) 5LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3000,
    "total_value": 3000,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-477-1-15-9MM-10LB",
    "item_name": "477-1 (15.9mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3915.86,
    "total_value": 3915.86,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-477-1-19-1MM-10LB",
    "item_name": "477-1 (19.1mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 4994.4,
    "total_value": 4994.4,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-477-1-25-4MM-10LB",
    "item_name": "477-1 (25.4mm) 10LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 3915.86,
    "total_value": 3915.86,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-477-1-9-5MM-2LB",
    "item_name": "477-1 ( 9.5mm) 2LB",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 1089.35,
    "total_value": 2178.69,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "001046",
    "item_name": "CMS 2000 3.8 Ltr",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 3,
    "unit_cost": 3368.12,
    "total_value": 10104.37,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-FLEX-PACKING-TOOL-SET",
    "item_name": "Flex Packing Tool Set",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "SET",
    "quantity": 1,
    "unit_cost": 696.58,
    "total_value": 696.58,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-TAMP-TL-0",
    "item_name": "Tamp TL#0",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 51.88,
    "total_value": 51.88,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-TAMP-TL-1-220-PUMP",
    "item_name": "Tamp TL#1 .220 pump",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 93.37,
    "total_value": 93.37,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-TAMP-TL-2-330-PUMP",
    "item_name": "Tamp TL#2 .330 pump",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 93.37,
    "total_value": 93.37,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-PKG-TAMP-TL-3-516-PUMP",
    "item_name": "Tamp TL#3 .516 pump",
    "category": "CH Mechanical Packing & Gasketing",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 90.73,
    "total_value": 90.73,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-491-DIN-32MM-SA",
    "item_name": "491/DIN 32mm SA",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 4610,
    "total_value": 4610,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-491-DIN-43MM-SA",
    "item_name": "491/DIN 43mm SA",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 5252,
    "total_value": 5252,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-16M-RU-CB-S-EP",
    "item_name": "RBS 16M RU CB S EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 194.88,
    "total_value": 194.88,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-25M-RU-CB-S-EP",
    "item_name": "RBS 25M RU CB S EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 185,
    "total_value": 370,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-28M-RU-CB-S-EP",
    "item_name": "RBS 28M RU CB S EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 299.79,
    "total_value": 299.79,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-33M-RU-CB-S-EP",
    "item_name": "RBS 33M RU CB S EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 218,
    "total_value": 436,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-43M-RU-CB-S-EP",
    "item_name": "RBS 43M RU CB S EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 307,
    "total_value": 614,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-48M-RU-CB-S-EP",
    "item_name": "RBS 48M RU CB S EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 369,
    "total_value": 738,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-55M-RU-CB-S-EP",
    "item_name": "RBS 55M RU CB S EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 1126.4,
    "total_value": 1126.4,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-K-16M-SU-SC-EP",
    "item_name": "RBS K 16M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 259.84,
    "total_value": 259.84,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-KS-25M-SU-SC-EP",
    "item_name": "RBS KS 25M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 112,
    "total_value": 112,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-KS-28M-SU-SC-EP",
    "item_name": "RBS KS 28M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 184.82,
    "total_value": 184.82,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-KS-33M-SU-SC-EP",
    "item_name": "RBS KS 33M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 139,
    "total_value": 139,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-KS-48M-SU-SC-EP",
    "item_name": "RBS KS 48M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 214,
    "total_value": 214,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-KS-55M-SU-SC-EP",
    "item_name": "RBS KS 55M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 4,
    "unit_cost": 564.95,
    "total_value": 2259.8,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-S-25M-SU-SC-EP",
    "item_name": "RBS S 25M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 142,
    "total_value": 284,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-SEAL-RBS-S-48M-SU-SC-EP",
    "item_name": "RBS S 48M SU SC EP",
    "category": "CH Mechanical Seals",
    "uom": "PCS",
    "quantity": 2,
    "unit_cost": 277,
    "total_value": 554,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-IIOT-CHESTERTON-CONNECT-IS",
    "item_name": "Chesterton Connect (IS)",
    "category": "CH Smart/IIOT Products",
    "uom": "PCS",
    "quantity": 1,
    "unit_cost": 5301.51,
    "total_value": 5301.51,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-IIOT-CHESTERTON-CONNECT-V1-NON",
    "item_name": "Chesterton Connect V1 (Non IS)",
    "category": "CH Smart/IIOT Products",
    "uom": "PCS",
    "quantity": 5,
    "unit_cost": 4340.58,
    "total_value": 21702.9,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "CH-IIOT-CHESTERTON-TEKCELL-SB-D02",
    "item_name": "Chesterton Tekcell SB-D02 3.6V 19Ah Battery",
    "category": "CH Smart/IIOT Products",
    "uom": "PCS",
    "quantity": 10,
    "unit_cost": 79.6,
    "total_value": 796,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "I FR PRO Orange",
    "item_name": "Inherent FR PRO Orange Coverall",
    "category": "PPE Coverall",
    "uom": "PCS",
    "quantity": 674,
    "unit_cost": 158.06,
    "total_value": 106531.97,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "I FR PRO Yellow ",
    "item_name": "Inherent FR PRO Yellow Coverall",
    "category": "PPE Coverall",
    "uom": "PCS",
    "quantity": 1906,
    "unit_cost": 158.06,
    "total_value": 301261.06,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "T FR PRO Royal Blue",
    "item_name": "Treated FR PRO Royal Blue Coverall",
    "category": "PPE Coverall",
    "uom": "PCS",
    "quantity": 1710,
    "unit_cost": 56.59,
    "total_value": 96767.43,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "T FR PRO Yellow ",
    "item_name": "Treated FR PRO Yellow Coverall",
    "category": "PPE Coverall",
    "uom": "PCS",
    "quantity": 222,
    "unit_cost": 56.59,
    "total_value": 12562.79,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-CUT-ACE-5-D-L",
    "item_name": "Ranger Cut Ace 5-D (L)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 2592,
    "unit_cost": 5.74,
    "total_value": 14885.78,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-CUT-ACE-5-D-M",
    "item_name": "Ranger Cut Ace 5-D (M)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 1008,
    "unit_cost": 5.74,
    "total_value": 5788.89,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-CUT-ACE-5-D-XL",
    "item_name": "Ranger Cut Ace 5-D (XL)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 1440,
    "unit_cost": 5.74,
    "total_value": 8269.88,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-DOUBLE-DOTS",
    "item_name": "Ranger Double Dots",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 1750,
    "unit_cost": 0.73,
    "total_value": 1283.66,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-DOUBLE-RIG",
    "item_name": "Ranger Double Rig",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 120,
    "unit_cost": 3.39,
    "total_value": 406.73,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-FLEX-ACE-L",
    "item_name": "Ranger Flex Ace (L)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 7532,
    "unit_cost": 3.93,
    "total_value": 29613.72,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-FLEX-ACE-M",
    "item_name": "Ranger Flex Ace (M)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 4608,
    "unit_cost": 3.93,
    "total_value": 18117.37,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-FLEX-ACE-XL",
    "item_name": "Ranger Flex Ace (XL)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 3024,
    "unit_cost": 3.98,
    "total_value": 12023.06,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-IMPACT-ACE-5-D-L",
    "item_name": "Ranger Impact Ace 5-D (L)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 2520,
    "unit_cost": 21.27,
    "total_value": 53595.26,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-IMPACT-ACE-5-D-M",
    "item_name": "Ranger Impact Ace 5-D (M)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 504,
    "unit_cost": 21.27,
    "total_value": 10719.06,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-IMPACT-ACE-5-D-XL",
    "item_name": "Ranger Impact Ace 5-D (XL)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 1512,
    "unit_cost": 21.27,
    "total_value": 32157.16,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-IMPACT-ACE-5-D-XXL",
    "item_name": "Ranger Impact Ace 5-D (XXL)",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 468,
    "unit_cost": 21.27,
    "total_value": 9953.41,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-R-WELD",
    "item_name": "Ranger R Weld",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 2050,
    "unit_cost": 7.06,
    "total_value": 14469.06,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-TIG",
    "item_name": "Ranger Tig",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 3260,
    "unit_cost": 7.75,
    "total_value": 25270.38,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-GLV-RANGER-TORCH-WELD",
    "item_name": "Ranger Torch Weld",
    "category": "PPE Gloves",
    "uom": "PAIR",
    "quantity": 1344,
    "unit_cost": 8.98,
    "total_value": 12063.21,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-037",
    "item_name": "FLINT High Brown Size 037",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 7,
    "unit_cost": 155.36,
    "total_value": 1087.49,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-038",
    "item_name": "FLINT High Brown Size 038",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 3,
    "unit_cost": 157.96,
    "total_value": 473.88,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-039",
    "item_name": "FLINT High Brown Size 039",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 5,
    "unit_cost": 155.07,
    "total_value": 775.34,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-040",
    "item_name": "FLINT High Brown Size 040",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 14,
    "unit_cost": 154.9,
    "total_value": 2168.55,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-041",
    "item_name": "FLINT High Brown Size 041",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 7,
    "unit_cost": 154.71,
    "total_value": 1082.94,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-042",
    "item_name": "FLINT High Brown Size 042",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 3,
    "unit_cost": 154.41,
    "total_value": 463.23,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-043",
    "item_name": "FLINT High Brown Size 043",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 10,
    "unit_cost": 154.05,
    "total_value": 1540.54,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-044",
    "item_name": "FLINT High Brown Size 044",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 2,
    "unit_cost": 157.96,
    "total_value": 315.92,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-045",
    "item_name": "FLINT High Brown Size 045",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 2,
    "unit_cost": 157.96,
    "total_value": 315.92,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-046",
    "item_name": "FLINT High Brown Size 046",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 4,
    "unit_cost": 157.96,
    "total_value": 631.84,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-FLINT-HIGH-BROWN-SIZE-047",
    "item_name": "FLINT High Brown Size 047",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 6,
    "unit_cost": 153.62,
    "total_value": 921.72,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-TOPAZE-HIGH-SAFETY-SHOES",
    "item_name": "TOPAZE High Safety Shoes EH 40",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 7,
    "unit_cost": 183.16,
    "total_value": 1282.12,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-TOPAZE-HIGH-SAFETY-SHOES-1",
    "item_name": "TOPAZE High Safety Shoes EH 41",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 3,
    "unit_cost": 185.61,
    "total_value": 556.84,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-TOPAZE-HIGH-SAFETY-SHOES-2",
    "item_name": "TOPAZE High Safety Shoes EH 43",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 3,
    "unit_cost": 184.64,
    "total_value": 553.92,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-TOPAZE-HIGH-SAFETY-SHOES-3",
    "item_name": "TOPAZE High Safety Shoes EH 44",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 11,
    "unit_cost": 185.1,
    "total_value": 2036.13,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-TOPAZE-HIGH-SAFETY-SHOES-4",
    "item_name": "TOPAZE High Safety Shoes EH 45",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 2,
    "unit_cost": 188.34,
    "total_value": 376.68,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-TOPAZE-HIGH-SAFETY-SHOES-5",
    "item_name": "TOPAZE High Safety Shoes EH 46",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 7,
    "unit_cost": 188.34,
    "total_value": 1318.38,
    "warehouse": "Main Store Mesaieed"
  },
  {
    "item_code": "PPE-SHOE-TOPAZE-HIGH-SAFETY-SHOES-6",
    "item_name": "TOPAZE High Safety Shoes EH 47",
    "category": "PPE Safety Shoes",
    "uom": "PAIR",
    "quantity": 5,
    "unit_cost": 183.16,
    "total_value": 915.8,
    "warehouse": "Main Store Mesaieed"
  }
];
