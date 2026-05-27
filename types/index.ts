export type TestkitStatus =
  | 'received'
  | 'assigned'
  | 'retour'
  | 'sent_nightingale'
  | 'results_available'

export interface Testkit {
  id: string
  barcode: string
  date: string
  assigned: boolean
  assigned_client_id: string | null
  assigned_company_id: string | null
  assigned_arbo_id: string | null
  assigned_date: string | null
  retour_date: string | null
  badge_id: string | null
  badge_datesent: string | null
  results_date: string | null
  status: TestkitStatus
  created_at: string
  // joined
  vh_client?: Client | null
  vh_company?: Company | null
  vh_arbo?: Arbo | null
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  created_at: string
}

export interface Company {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  kvk: string | null
  created_at: string
}

export interface Arbo {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  created_at: string
}
