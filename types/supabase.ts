export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_groups: {
        Row: {
          code_prefix_end: string | null
          code_prefix_start: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: string | null
        }
        Insert: {
          code_prefix_end?: string | null
          code_prefix_start?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type?: string | null
        }
        Update: {
          code_prefix_end?: string | null
          code_prefix_start?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_account_groups: {
        Row: {
          code_prefix_end: string | null
          code_prefix_start: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          code_prefix_end?: string | null
          code_prefix_start?: string | null
          company_id: string
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          code_prefix_end?: string | null
          code_prefix_start?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_account_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_account_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_chart_of_accounts: {
        Row: {
          account_group_id: string | null
          balance_type: string | null
          code: string
          company_id: string
          created_at: string
          currency_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_group: boolean | null
          is_reconcilable: boolean | null
          name: string
          parent_id: string | null
          subtype: string | null
          type: string
        }
        Insert: {
          account_group_id?: string | null
          balance_type?: string | null
          code: string
          company_id: string
          created_at?: string
          currency_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          is_reconcilable?: boolean | null
          name: string
          parent_id?: string | null
          subtype?: string | null
          type: string
        }
        Update: {
          account_group_id?: string | null
          balance_type?: string | null
          code?: string
          company_id?: string
          created_at?: string
          currency_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          is_reconcilable?: boolean | null
          name?: string
          parent_id?: string | null
          subtype?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_chart_of_accounts_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "accounting_account_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_chart_of_accounts_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "financial_masters_currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_cost_centers: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          type: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          type: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_cost_centers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_direct_expense_ledgers: {
        Row: {
          account_id: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_direct_expense_ledgers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_direct_expense_ledgers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_entries: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          credit_account: string
          debit_account: string
          description: string | null
          id: string
          is_reversed: boolean | null
          reference_id: string | null
          reference_type: string | null
          reversal_reason: string | null
          status: string | null
          transaction_date: string
        }
        Insert: {
          amount: number
          company_id?: string
          created_at?: string
          credit_account: string
          debit_account: string
          description?: string | null
          id?: string
          is_reversed?: boolean | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_reason?: string | null
          status?: string | null
          transaction_date: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          credit_account?: string
          debit_account?: string
          description?: string | null
          id?: string
          is_reversed?: boolean | null
          reference_id?: string | null
          reference_type?: string | null
          reversal_reason?: string | null
          status?: string | null
          transaction_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_reference_id_fkey"
            columns: ["reference_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_fiscal_years: {
        Row: {
          company_id: string
          created_at: string
          end_date: string
          id: string
          is_closed: boolean | null
          name: string
          start_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date: string
          id?: string
          is_closed?: boolean | null
          name: string
          start_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          is_closed?: boolean | null
          name?: string
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_fiscal_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_indirect_income_ledgers: {
        Row: {
          account_id: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_indirect_income_ledgers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_indirect_income_ledgers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_journal_entries: {
        Row: {
          amount_residual: number
          amount_total: number
          approval_status: string
          company_id: string
          created_at: string
          date: string
          due_date: string | null
          id: string
          invoice_date: string | null
          journal_id: string
          move_type: string
          notes: string | null
          partner_id: string | null
          period_id: string | null
          reference: string | null
          state: string
          supplier_invoice_number: string | null
        }
        Insert: {
          amount_residual?: number
          amount_total?: number
          approval_status?: string
          company_id: string
          created_at?: string
          date?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          journal_id: string
          move_type?: string
          notes?: string | null
          partner_id?: string | null
          period_id?: string | null
          reference?: string | null
          state?: string
          supplier_invoice_number?: string | null
        }
        Update: {
          amount_residual?: number
          amount_total?: number
          approval_status?: string
          company_id?: string
          created_at?: string
          date?: string
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          journal_id?: string
          move_type?: string
          notes?: string | null
          partner_id?: string | null
          period_id?: string | null
          reference?: string | null
          state?: string
          supplier_invoice_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "accounting_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_journal_lines: {
        Row: {
          account_id: string
          balance: number | null
          company_id: string
          contract_cost_center_id: string | null
          cost_center_id: string | null
          created_at: string
          credit: number
          debit: number
          entry_id: string
          id: string
          item_id: string | null
          name: string | null
          partner_id: string | null
          project_cost_center_id: string | null
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          account_id: string
          balance?: number | null
          company_id: string
          contract_cost_center_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          entry_id: string
          id?: string
          item_id?: string | null
          name?: string | null
          partner_id?: string | null
          project_cost_center_id?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          account_id?: string
          balance?: number | null
          company_id?: string
          contract_cost_center_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          credit?: number
          debit?: number
          entry_id?: string
          id?: string
          item_id?: string | null
          name?: string | null
          partner_id?: string | null
          project_cost_center_id?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_contract_cost_center_id_fkey"
            columns: ["contract_cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journal_lines_project_cost_center_id_fkey"
            columns: ["project_cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_journals: {
        Row: {
          code: string
          company_id: string
          created_at: string
          default_account_id: string | null
          id: string
          is_active: boolean | null
          name: string
          sequence_prefix: string | null
          type: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          default_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sequence_prefix?: string | null
          type: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          default_account_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sequence_prefix?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_journals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_journals_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_move_lines: {
        Row: {
          account_id: string
          amount_currency: number | null
          analytic_account_id: string | null
          balance: number | null
          company_id: string
          created_at: string
          credit: number | null
          currency_id: string | null
          date: string
          debit: number | null
          full_reconcile_id: string | null
          id: string
          journal_id: string | null
          move_id: string | null
          name: string | null
          partner_id: string | null
          tax_line_id: string | null
        }
        Insert: {
          account_id: string
          amount_currency?: number | null
          analytic_account_id?: string | null
          balance?: number | null
          company_id?: string
          created_at?: string
          credit?: number | null
          currency_id?: string | null
          date: string
          debit?: number | null
          full_reconcile_id?: string | null
          id?: string
          journal_id?: string | null
          move_id?: string | null
          name?: string | null
          partner_id?: string | null
          tax_line_id?: string | null
        }
        Update: {
          account_id?: string
          amount_currency?: number | null
          analytic_account_id?: string | null
          balance?: number | null
          company_id?: string
          created_at?: string
          credit?: number | null
          currency_id?: string | null
          date?: string
          debit?: number | null
          full_reconcile_id?: string | null
          id?: string
          journal_id?: string | null
          move_id?: string | null
          name?: string | null
          partner_id?: string | null
          tax_line_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_move_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_move_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_move_lines_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "accounting_moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_move_lines_tax_line_id_fkey"
            columns: ["tax_line_id"]
            isOneToOne: false
            referencedRelation: "taxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_move_line_partner"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_moves: {
        Row: {
          amount_residual: number | null
          amount_total: number | null
          approval_status: string | null
          auto_generated: boolean | null
          company_id: string
          created_at: string
          date: string
          due_date: string | null
          id: string
          inventory_txn_id: string | null
          invoice_date: string | null
          invoice_id: string | null
          journal_id: string
          move_type: string | null
          notes: string | null
          partner_id: string | null
          payment_id: string | null
          period_id: string | null
          reference: string | null
          state: string | null
        }
        Insert: {
          amount_residual?: number | null
          amount_total?: number | null
          approval_status?: string | null
          auto_generated?: boolean | null
          company_id?: string
          created_at?: string
          date?: string
          due_date?: string | null
          id?: string
          inventory_txn_id?: string | null
          invoice_date?: string | null
          invoice_id?: string | null
          journal_id: string
          move_type?: string | null
          notes?: string | null
          partner_id?: string | null
          payment_id?: string | null
          period_id?: string | null
          reference?: string | null
          state?: string | null
        }
        Update: {
          amount_residual?: number | null
          amount_total?: number | null
          approval_status?: string | null
          auto_generated?: boolean | null
          company_id?: string
          created_at?: string
          date?: string
          due_date?: string | null
          id?: string
          inventory_txn_id?: string | null
          invoice_date?: string | null
          invoice_id?: string | null
          journal_id?: string
          move_type?: string | null
          notes?: string | null
          partner_id?: string | null
          payment_id?: string | null
          period_id?: string | null
          reference?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_moves_inventory_txn_id_fkey"
            columns: ["inventory_txn_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_moves_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_moves_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "accounting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_move_partner"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_partners: {
        Row: {
          city: string | null
          code: string | null
          company_id: string
          country: string | null
          created_at: string
          credit_limit: number | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          partner_type: string | null
          payment_term_days: number | null
          phone: string | null
          postal_code: string | null
          property_account_payable_id: string | null
          property_account_receivable_id: string | null
          reference_code: string | null
          state: string | null
          street: string | null
          tax_id: string | null
        }
        Insert: {
          city?: string | null
          code?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          partner_type?: string | null
          payment_term_days?: number | null
          phone?: string | null
          postal_code?: string | null
          property_account_payable_id?: string | null
          property_account_receivable_id?: string | null
          reference_code?: string | null
          state?: string | null
          street?: string | null
          tax_id?: string | null
        }
        Update: {
          city?: string | null
          code?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          partner_type?: string | null
          payment_term_days?: number | null
          phone?: string | null
          postal_code?: string | null
          property_account_payable_id?: string | null
          property_account_receivable_id?: string | null
          reference_code?: string | null
          state?: string | null
          street?: string | null
          tax_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_partners_property_account_payable_id_fkey"
            columns: ["property_account_payable_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_partners_property_account_receivable_id_fkey"
            columns: ["property_account_receivable_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_payment_terms: {
        Row: {
          company_id: string
          created_at: string
          days: number
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          days: number
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          days?: number
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_payment_terms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_payments: {
        Row: {
          account_id: string | null
          accounting_entry_id: string | null
          accounting_journal_id: string | null
          amount: number
          bank_account: string | null
          bank_lines: Json | null
          bank_name: string | null
          company_id: string
          created_at: string
          date: string
          expense_lines: Json | null
          id: string
          instrument_date: string | null
          journal_id: string | null
          move_id: string | null
          name: string | null
          notes: string | null
          partner_id: string | null
          partner_type: string
          payment_category: string | null
          payment_method_line_id: string | null
          payment_type: string
          state: string | null
        }
        Insert: {
          account_id?: string | null
          accounting_entry_id?: string | null
          accounting_journal_id?: string | null
          amount: number
          bank_account?: string | null
          bank_lines?: Json | null
          bank_name?: string | null
          company_id?: string
          created_at?: string
          date?: string
          expense_lines?: Json | null
          id?: string
          instrument_date?: string | null
          journal_id?: string | null
          move_id?: string | null
          name?: string | null
          notes?: string | null
          partner_id?: string | null
          partner_type: string
          payment_category?: string | null
          payment_method_line_id?: string | null
          payment_type: string
          state?: string | null
        }
        Update: {
          account_id?: string | null
          accounting_entry_id?: string | null
          accounting_journal_id?: string | null
          amount?: number
          bank_account?: string | null
          bank_lines?: Json | null
          bank_name?: string | null
          company_id?: string
          created_at?: string
          date?: string
          expense_lines?: Json | null
          id?: string
          instrument_date?: string | null
          journal_id?: string | null
          move_id?: string | null
          name?: string | null
          notes?: string | null
          partner_id?: string | null
          partner_type?: string
          payment_category?: string | null
          payment_method_line_id?: string | null
          payment_type?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_accounting_entry_id_fkey"
            columns: ["accounting_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_accounting_journal_id_fkey"
            columns: ["accounting_journal_id"]
            isOneToOne: false
            referencedRelation: "accounting_journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "accounting_moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_payments_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_periods: {
        Row: {
          accounting_fiscal_year_id: string | null
          code: string | null
          company_id: string
          created_at: string
          end_date: string
          fiscal_year_id: string | null
          id: string
          name: string
          start_date: string
          status: string | null
        }
        Insert: {
          accounting_fiscal_year_id?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          end_date: string
          fiscal_year_id?: string | null
          id?: string
          name: string
          start_date: string
          status?: string | null
        }
        Update: {
          accounting_fiscal_year_id?: string | null
          code?: string | null
          company_id?: string
          created_at?: string
          end_date?: string
          fiscal_year_id?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounting_periods_accounting_fiscal_year_id_fkey"
            columns: ["accounting_fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "accounting_fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_periods_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_purchase_ledgers: {
        Row: {
          account_id: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_purchase_ledgers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_purchase_ledgers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_sales_ledgers: {
        Row: {
          account_id: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_sales_ledgers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_sales_ledgers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_stock_categories: {
        Row: {
          adjustment_account_id: string | null
          asset_account_id: string | null
          cogs_account_id: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          item_category: string
          name: string
        }
        Insert: {
          adjustment_account_id?: string | null
          asset_account_id?: string | null
          cogs_account_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_category: string
          name: string
        }
        Update: {
          adjustment_account_id?: string | null
          asset_account_id?: string | null
          cogs_account_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          item_category?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_stock_categories_adjustment_account_id_fkey"
            columns: ["adjustment_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_stock_categories_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_stock_categories_cogs_account_id_fkey"
            columns: ["cogs_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_stock_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_taxes: {
        Row: {
          account_id: string | null
          amount: number
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          refund_account_id: string | null
          scope: string
          type: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          refund_account_id?: string | null
          scope?: string
          type?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          refund_account_id?: string | null
          scope?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_taxes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_taxes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_taxes_refund_account_id_fkey"
            columns: ["refund_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string | null
          company_id: string
          content: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_pinned: boolean | null
          title: string
          type: string | null
        }
        Insert: {
          author_id?: string | null
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          title: string
          type?: string | null
        }
        Update: {
          author_id?: string | null
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      assets: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          purchase_date: string | null
          serial_number: string | null
          status: string | null
          type: string
          warranty_expiry: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          type: string
          warranty_expiry?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          purchase_date?: string | null
          serial_number?: string | null
          status?: string | null
          type?: string
          warranty_expiry?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_period_id: string | null
          attendance_status_id: number | null
          check_in: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_location: string | null
          check_out: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_location: string | null
          company_id: string
          created_at: string
          date: string
          duration: number | null
          early_minutes: number | null
          edit_reason: string | null
          edited_at: string | null
          edited_by: string | null
          employee_id: string | null
          id: string
          is_early_leaving: boolean | null
          is_late: boolean | null
          is_processed: boolean | null
          late_minutes: number | null
          notes: string | null
          ot_hours: number | null
          punch_method: string | null
          shift_id: number | null
          source: string | null
          status: string | null
          total_hours: number | null
        }
        Insert: {
          attendance_period_id?: string | null
          attendance_status_id?: number | null
          check_in?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_location?: string | null
          check_out?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_location?: string | null
          company_id?: string
          created_at?: string
          date: string
          duration?: number | null
          early_minutes?: number | null
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id?: string | null
          id?: string
          is_early_leaving?: boolean | null
          is_late?: boolean | null
          is_processed?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          ot_hours?: number | null
          punch_method?: string | null
          shift_id?: number | null
          source?: string | null
          status?: string | null
          total_hours?: number | null
        }
        Update: {
          attendance_period_id?: string | null
          attendance_status_id?: number | null
          check_in?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_location?: string | null
          check_out?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_location?: string | null
          company_id?: string
          created_at?: string
          date?: string
          duration?: number | null
          early_minutes?: number | null
          edit_reason?: string | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id?: string | null
          id?: string
          is_early_leaving?: boolean | null
          is_late?: boolean | null
          is_processed?: boolean | null
          late_minutes?: number | null
          notes?: string | null
          ot_hours?: number | null
          punch_method?: string | null
          shift_id?: number | null
          source?: string | null
          status?: string | null
          total_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_attendance_period_id_fkey"
            columns: ["attendance_period_id"]
            isOneToOne: false
            referencedRelation: "attendance_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "org_shift_timings"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_corrections_log: {
        Row: {
          attendance_id: string
          attendance_period_id: string | null
          changed_by: string | null
          company_id: string
          correction_reason: string
          created_at: string
          date: string
          employee_id: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          attendance_id: string
          attendance_period_id?: string | null
          changed_by?: string | null
          company_id: string
          correction_reason: string
          created_at?: string
          date: string
          employee_id: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          attendance_id?: string
          attendance_period_id?: string | null
          changed_by?: string | null
          company_id?: string
          correction_reason?: string
          created_at?: string
          date?: string
          employee_id?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_corrections_log_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_log_attendance_period_id_fkey"
            columns: ["attendance_period_id"]
            isOneToOne: false
            referencedRelation: "attendance_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_corrections_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_periods: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          end_date: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          month: number | null
          name: string
          payroll_transfer_date: string | null
          payroll_transfer_status: string | null
          processed_at: string | null
          processed_by: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          start_date: string
          status: string
          summary_snapshot: Json | null
          year: number | null
        }
        Insert: {
          code?: string | null
          company_id?: string
          created_at?: string
          end_date: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          month?: number | null
          name: string
          payroll_transfer_date?: string | null
          payroll_transfer_status?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          start_date: string
          status?: string
          summary_snapshot?: Json | null
          year?: number | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          end_date?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          month?: number | null
          name?: string
          payroll_transfer_date?: string | null
          payroll_transfer_status?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          start_date?: string
          status?: string
          summary_snapshot?: Json | null
          year?: number | null
        }
        Relationships: []
      }
      attendance_records: {
        Row: {
          check_in: string | null
          check_out: string | null
          company_id: string
          created_at: string
          date: string
          employee_id: string | null
          id: string
          notes: string | null
          status: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          company_id?: string
          created_at?: string
          date: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          company_id?: string
          created_at?: string
          date?: string
          employee_id?: string | null
          id?: string
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          auto_absent_if_no_punch: boolean | null
          break_minutes: number | null
          company_id: string
          created_at: string | null
          early_deduction_amount: number | null
          early_deduction_enabled: boolean | null
          early_deduction_type: string | null
          grace_minutes_early: number | null
          grace_minutes_late: number | null
          half_day_hours: number | null
          half_day_threshold: number | null
          holiday_ot_multiplier: number | null
          id: string
          late_deduction_amount: number | null
          late_deduction_enabled: boolean | null
          late_deduction_type: string | null
          late_half_day_threshold: number | null
          late_penalty_type: string | null
          max_ot_hours_per_day: number | null
          ot_approval_required: boolean | null
          ot_multiplier: number | null
          ot_threshold_hours: number | null
          standard_hours: number | null
          updated_at: string | null
          weekend_ot_multiplier: number | null
        }
        Insert: {
          auto_absent_if_no_punch?: boolean | null
          break_minutes?: number | null
          company_id: string
          created_at?: string | null
          early_deduction_amount?: number | null
          early_deduction_enabled?: boolean | null
          early_deduction_type?: string | null
          grace_minutes_early?: number | null
          grace_minutes_late?: number | null
          half_day_hours?: number | null
          half_day_threshold?: number | null
          holiday_ot_multiplier?: number | null
          id?: string
          late_deduction_amount?: number | null
          late_deduction_enabled?: boolean | null
          late_deduction_type?: string | null
          late_half_day_threshold?: number | null
          late_penalty_type?: string | null
          max_ot_hours_per_day?: number | null
          ot_approval_required?: boolean | null
          ot_multiplier?: number | null
          ot_threshold_hours?: number | null
          standard_hours?: number | null
          updated_at?: string | null
          weekend_ot_multiplier?: number | null
        }
        Update: {
          auto_absent_if_no_punch?: boolean | null
          break_minutes?: number | null
          company_id?: string
          created_at?: string | null
          early_deduction_amount?: number | null
          early_deduction_enabled?: boolean | null
          early_deduction_type?: string | null
          grace_minutes_early?: number | null
          grace_minutes_late?: number | null
          half_day_hours?: number | null
          half_day_threshold?: number | null
          holiday_ot_multiplier?: number | null
          id?: string
          late_deduction_amount?: number | null
          late_deduction_enabled?: boolean | null
          late_deduction_type?: string | null
          late_half_day_threshold?: number | null
          late_penalty_type?: string | null
          max_ot_hours_per_day?: number | null
          ot_approval_required?: boolean | null
          ot_multiplier?: number | null
          ot_threshold_hours?: number | null
          standard_hours?: number | null
          updated_at?: string | null
          weekend_ot_multiplier?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          date: string
          id: string
          is_reconciled: boolean | null
          partner_id: string | null
          partner_name: string | null
          payment_id: string | null
          payment_ref: string | null
          statement_id: string | null
        }
        Insert: {
          amount: number
          company_id?: string
          created_at?: string
          date: string
          id?: string
          is_reconciled?: boolean | null
          partner_id?: string | null
          partner_name?: string | null
          payment_id?: string | null
          payment_ref?: string | null
          statement_id?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          is_reconciled?: boolean | null
          partner_id?: string | null
          partner_name?: string | null
          payment_id?: string | null
          payment_ref?: string | null
          statement_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "accounting_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          balance_end_calculated: number | null
          balance_end_real: number | null
          balance_start: number | null
          company_id: string
          created_at: string
          date: string
          id: string
          journal_id: string
          name: string
          state: string | null
        }
        Insert: {
          balance_end_calculated?: number | null
          balance_end_real?: number | null
          balance_start?: number | null
          company_id?: string
          created_at?: string
          date: string
          id?: string
          journal_id: string
          name: string
          state?: string | null
        }
        Update: {
          balance_end_calculated?: number | null
          balance_end_real?: number | null
          balance_start?: number | null
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          journal_id?: string
          name?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "accounting_journals"
            referencedColumns: ["id"]
          },
        ]
      }
      buzz_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buzz_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "buzz_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      buzz_posts: {
        Row: {
          author_id: string | null
          comments_count: number | null
          company_id: string
          content: string | null
          created_at: string
          id: string
          likes_count: number | null
          parent_id: string | null
          type: string | null
        }
        Insert: {
          author_id?: string | null
          comments_count?: number | null
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          type?: string | null
        }
        Update: {
          author_id?: string | null
          comments_count?: number | null
          company_id?: string
          content?: string | null
          created_at?: string
          id?: string
          likes_count?: number | null
          parent_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buzz_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "buzz_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      career_paths: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          steps: Json | null
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          steps?: Json | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          steps?: Json | null
          title?: string
        }
        Relationships: []
      }
      chart_of_accounts: {
        Row: {
          account_group_id: string | null
          code: string
          company_id: string
          created_at: string
          currency_id: string | null
          id: string
          is_active: boolean | null
          is_reconcilable: boolean | null
          name: string
          subtype: string | null
          type: string
        }
        Insert: {
          account_group_id?: string | null
          code: string
          company_id?: string
          created_at?: string
          currency_id?: string | null
          id?: string
          is_active?: boolean | null
          is_reconcilable?: boolean | null
          name: string
          subtype?: string | null
          type: string
        }
        Update: {
          account_group_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          currency_id?: string | null
          id?: string
          is_active?: boolean | null
          is_reconcilable?: boolean | null
          name?: string
          subtype?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_account_group_id_fkey"
            columns: ["account_group_id"]
            isOneToOne: false
            referencedRelation: "account_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          created_at: string | null
          id: string
          message: string | null
          room_id: string | null
          sender_id: string | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string | null
          id?: string
          message?: string | null
          room_id?: string | null
          sender_id?: string | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string | null
          id?: string
          message?: string | null
          room_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          created_at: string | null
          id: string
          profile_id: string | null
          room_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          room_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_id?: string | null
          room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          company_id: string
          created_at: string | null
          department_id: number | null
          id: string
          name: string | null
          type: string
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          department_id?: number | null
          id?: string
          name?: string | null
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          department_id?: number | null
          id?: string
          name?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          currency: string | null
          display_name: string | null
          email: string | null
          group_company_id: string | null
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          phone: string | null
          state: string | null
          status: string | null
          subscription_status: string | null
          tax_id: string | null
          theme_color: string | null
          timezone: string | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          display_name?: string | null
          email?: string | null
          group_company_id?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          state?: string | null
          status?: string | null
          subscription_status?: string | null
          tax_id?: string | null
          theme_color?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          currency?: string | null
          display_name?: string | null
          email?: string | null
          group_company_id?: string | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          state?: string | null
          status?: string | null
          subscription_status?: string | null
          tax_id?: string | null
          theme_color?: string | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_group_company_id_fkey"
            columns: ["group_company_id"]
            isOneToOne: false
            referencedRelation: "group_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity_log: {
        Row: {
          action: string
          company_id: string
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          company_id?: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_attachments: {
        Row: {
          company_id: string
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          module: string
          record_id: string
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          module: string
          record_id: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          module?: string
          record_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_automations: {
        Row: {
          action_config: Json | null
          action_type: string
          company_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_config: Json | null
          trigger_event: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          company_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_config?: Json | null
          trigger_event: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_config?: Json | null
          trigger_event?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          company: string | null
          company_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: number
          last_contact: string | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          company?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: number
          last_contact?: string | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          company?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: number
          last_contact?: string | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          billing_address_line_1: string | null
          billing_address_line_2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_state: string | null
          billing_zip_code: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_type: string | null
          id: string
          industry: string | null
          lifecycle_stage: string | null
          name: string
          owner_id: string | null
          primary_email: string | null
          primary_phone: string | null
          status: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_address_line_1?: string | null
          billing_address_line_2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip_code?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          id?: string
          industry?: string | null
          lifecycle_stage?: string | null
          name: string
          owner_id?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_address_line_1?: string | null
          billing_address_line_2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_state?: string | null
          billing_zip_code?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          id?: string
          industry?: string | null
          lifecycle_stage?: string | null
          name?: string
          owner_id?: string | null
          primary_email?: string | null
          primary_phone?: string | null
          status?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          company: string
          company_id: string
          created_at: string
          created_by: string | null
          due_date: string | null
          employee_owner_id: string | null
          id: number
          owner_id: string | null
          pending_target_stage_id: string | null
          stage: string | null
          stage_id: string | null
          tag: string | null
          tag_color: string | null
          title: string
          value: number | null
        }
        Insert: {
          company: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          employee_owner_id?: string | null
          id?: number
          owner_id?: string | null
          pending_target_stage_id?: string | null
          stage?: string | null
          stage_id?: string | null
          tag?: string | null
          tag_color?: string | null
          title: string
          value?: number | null
        }
        Update: {
          company?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          employee_owner_id?: string | null
          id?: number
          owner_id?: string | null
          pending_target_stage_id?: string | null
          stage?: string | null
          stage_id?: string | null
          tag?: string | null
          tag_color?: string | null
          title?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_employee_owner_id_fkey"
            columns: ["employee_owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_delivery_note_lines: {
        Row: {
          delivery_note_id: string | null
          description: string | null
          id: string
          item_id: string | null
          item_name: string
          quantity_delivered: number
          quantity_ordered: number
          sort_order: number | null
          uom: string | null
        }
        Insert: {
          delivery_note_id?: string | null
          description?: string | null
          id?: string
          item_id?: string | null
          item_name: string
          quantity_delivered?: number
          quantity_ordered?: number
          sort_order?: number | null
          uom?: string | null
        }
        Update: {
          delivery_note_id?: string | null
          description?: string | null
          id?: string
          item_id?: string | null
          item_name?: string
          quantity_delivered?: number
          quantity_ordered?: number
          sort_order?: number | null
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_delivery_note_lines_delivery_note_id_fkey"
            columns: ["delivery_note_id"]
            isOneToOne: false
            referencedRelation: "crm_delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_delivery_notes: {
        Row: {
          company_id: string
          created_at: string | null
          customer_id: string | null
          delivery_date: string | null
          id: string
          invoice_id: string | null
          owner_id: string | null
          quotation_id: string | null
          series: string | null
          status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          invoice_id?: string | null
          owner_id?: string | null
          quotation_id?: string | null
          series?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          invoice_id?: string | null
          owner_id?: string | null
          quotation_id?: string | null
          series?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_delivery_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "crm_sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_documents: {
        Row: {
          company_id: string | null
          created_at: string | null
          document_type_id: number | null
          file_url: string
          id: string
          name: string
          related_id: string | null
          related_type: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          document_type_id?: number | null
          file_url: string
          id?: string
          name: string
          related_id?: string | null
          related_type?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          document_type_id?: number | null
          file_url?: string
          id?: string
          name?: string
          related_id?: string | null
          related_type?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          annual_revenue: number | null
          city: string | null
          company_id: string
          converted_customer_id: string | null
          converted_opportunity_id: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          fax: string | null
          first_name: string
          gender: string | null
          id: string
          industry: string | null
          is_converted: boolean | null
          job_title: string | null
          last_name: string | null
          lead_owner_id: string | null
          lead_source_id: string | null
          lead_type: string | null
          market_segment: string | null
          middle_name: string | null
          mobile: string | null
          no_of_employees: string | null
          organization_name: string | null
          phone: string | null
          phone_ext: string | null
          qualification_notes: string | null
          request_type: string | null
          salutation: string | null
          series: string | null
          state: string | null
          status: string | null
          territory: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          annual_revenue?: number | null
          city?: string | null
          company_id: string
          converted_customer_id?: string | null
          converted_opportunity_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          fax?: string | null
          first_name: string
          gender?: string | null
          id?: string
          industry?: string | null
          is_converted?: boolean | null
          job_title?: string | null
          last_name?: string | null
          lead_owner_id?: string | null
          lead_source_id?: string | null
          lead_type?: string | null
          market_segment?: string | null
          middle_name?: string | null
          mobile?: string | null
          no_of_employees?: string | null
          organization_name?: string | null
          phone?: string | null
          phone_ext?: string | null
          qualification_notes?: string | null
          request_type?: string | null
          salutation?: string | null
          series?: string | null
          state?: string | null
          status?: string | null
          territory?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          annual_revenue?: number | null
          city?: string | null
          company_id?: string
          converted_customer_id?: string | null
          converted_opportunity_id?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          fax?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          industry?: string | null
          is_converted?: boolean | null
          job_title?: string | null
          last_name?: string | null
          lead_owner_id?: string | null
          lead_source_id?: string | null
          lead_type?: string | null
          market_segment?: string | null
          middle_name?: string | null
          mobile?: string | null
          no_of_employees?: string | null
          organization_name?: string | null
          phone?: string | null
          phone_ext?: string | null
          qualification_notes?: string | null
          request_type?: string | null
          salutation?: string | null
          series?: string | null
          state?: string | null
          status?: string | null
          territory?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "org_lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_opportunities: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          customer_id: string | null
          expected_closing_date: string | null
          id: string
          lead_id: string | null
          owner_id: string | null
          probability: number | null
          series: string | null
          source_id: string | null
          stage_id: string | null
          status: string | null
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          expected_closing_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          probability?: number | null
          series?: string | null
          source_id?: string | null
          stage_id?: string | null
          status?: string | null
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          customer_id?: string | null
          expected_closing_date?: string | null
          id?: string
          lead_id?: string | null
          owner_id?: string | null
          probability?: number | null
          series?: string | null
          source_id?: string | null
          stage_id?: string | null
          status?: string | null
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "org_lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "org_crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_proposal_requests: {
        Row: {
          company_id: string
          created_at: string | null
          customer_details: Json | null
          customer_id: string | null
          id: string
          requested_delivery_date: string | null
          requester_id: string | null
          requirements: string
          status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          customer_details?: Json | null
          customer_id?: string | null
          id?: string
          requested_delivery_date?: string | null
          requester_id?: string | null
          requirements: string
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_details?: Json | null
          customer_id?: string | null
          id?: string
          requested_delivery_date?: string | null
          requester_id?: string | null
          requirements?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_proposal_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposal_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_proposals: {
        Row: {
          company_id: string
          created_at: string | null
          customer_id: string | null
          grand_total: number | null
          id: string
          is_locked: boolean | null
          pricing_details: Json | null
          request_id: string | null
          status: string | null
          terms_and_conditions: string | null
          title: string
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          grand_total?: number | null
          id?: string
          is_locked?: boolean | null
          pricing_details?: Json | null
          request_id?: string | null
          status?: string | null
          terms_and_conditions?: string | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          customer_id?: string | null
          grand_total?: number | null
          id?: string
          is_locked?: boolean | null
          pricing_details?: Json | null
          request_id?: string | null
          status?: string | null
          terms_and_conditions?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_proposals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "crm_proposal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quotation_lines: {
        Row: {
          description: string | null
          discount_percent: number | null
          id: string
          item_id: string | null
          item_name: string
          quantity: number
          quotation_id: string | null
          rate: number
          sort_order: number | null
          tax_percent: number | null
        }
        Insert: {
          description?: string | null
          discount_percent?: number | null
          id?: string
          item_id?: string | null
          item_name: string
          quantity?: number
          quotation_id?: string | null
          rate?: number
          sort_order?: number | null
          tax_percent?: number | null
        }
        Update: {
          description?: string | null
          discount_percent?: number | null
          id?: string
          item_id?: string | null
          item_name?: string
          quantity?: number
          quotation_id?: string | null
          rate?: number
          sort_order?: number | null
          tax_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_quotation_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotation_lines_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "crm_quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quotations: {
        Row: {
          company_id: string
          created_at: string | null
          currency: string | null
          customer_id: string | null
          discount_amount: number | null
          grand_total: number | null
          id: string
          notes: string | null
          opportunity_id: string | null
          owner_id: string | null
          quotation_date: string | null
          series: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          terms_and_conditions: string | null
          valid_until: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          owner_id?: string | null
          quotation_date?: string | null
          series?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          grand_total?: number | null
          id?: string
          notes?: string | null
          opportunity_id?: string | null
          owner_id?: string | null
          quotation_date?: string | null
          series?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotations_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "crm_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sales_invoice_lines: {
        Row: {
          description: string | null
          discount_percent: number | null
          id: string
          invoice_id: string | null
          item_id: string | null
          item_name: string
          quantity: number
          rate: number
          sort_order: number | null
          tax_percent: number | null
        }
        Insert: {
          description?: string | null
          discount_percent?: number | null
          id?: string
          invoice_id?: string | null
          item_id?: string | null
          item_name: string
          quantity?: number
          rate?: number
          sort_order?: number | null
          tax_percent?: number | null
        }
        Update: {
          description?: string | null
          discount_percent?: number | null
          id?: string
          invoice_id?: string | null
          item_id?: string | null
          item_name?: string
          quantity?: number
          rate?: number
          sort_order?: number | null
          tax_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_sales_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "crm_sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_sales_invoices: {
        Row: {
          amount_paid: number | null
          company_id: string
          created_at: string | null
          currency: string | null
          customer_id: string | null
          discount_amount: number | null
          due_date: string | null
          grand_total: number | null
          id: string
          invoice_date: string | null
          notes: string | null
          owner_id: string | null
          quotation_id: string | null
          series: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          terms_and_conditions: string | null
        }
        Insert: {
          amount_paid?: number | null
          company_id?: string
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          owner_id?: string | null
          quotation_id?: string | null
          series?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
        }
        Update: {
          amount_paid?: number | null
          company_id?: string
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          grand_total?: number | null
          id?: string
          invoice_date?: string | null
          notes?: string | null
          owner_id?: string | null
          quotation_id?: string | null
          series?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_and_conditions?: string | null
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          assignee: string | null
          company_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: number
          owner_id: string | null
          priority: string | null
          status: string | null
          title: string
        }
        Insert: {
          assignee?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: number
          owner_id?: string | null
          priority?: string | null
          status?: string | null
          title: string
        }
        Update: {
          assignee?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: number
          owner_id?: string | null
          priority?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      crm_website_finder_jobs: {
        Row: {
          company_id: string
          countries_checked: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          processed_records: number | null
          status: string | null
          total_records: number | null
        }
        Insert: {
          company_id: string
          countries_checked?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          processed_records?: number | null
          status?: string | null
          total_records?: number | null
        }
        Update: {
          company_id?: string
          countries_checked?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          processed_records?: number | null
          status?: string | null
          total_records?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_website_finder_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_website_finder_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_website_finder_results: {
        Row: {
          attempts: number | null
          branch_presence: Json | null
          company_name: string
          created_at: string | null
          id: string
          job_id: string
          raw_response: string | null
          status: string | null
          website_url: string | null
        }
        Insert: {
          attempts?: number | null
          branch_presence?: Json | null
          company_name: string
          created_at?: string | null
          id?: string
          job_id: string
          raw_response?: string | null
          status?: string | null
          website_url?: string | null
        }
        Update: {
          attempts?: number | null
          branch_presence?: Json | null
          company_name?: string
          created_at?: string | null
          id?: string
          job_id?: string
          raw_response?: string | null
          status?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_website_finder_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "crm_website_finder_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      delete_audit_logs: {
        Row: {
          deleted_at: string
          deleted_by_email: string
          deleted_by_uid: string
          id: string
          record_id: string
          record_name: string | null
          record_type: string
        }
        Insert: {
          deleted_at?: string
          deleted_by_email: string
          deleted_by_uid: string
          id?: string
          record_id: string
          record_name?: string | null
          record_type: string
        }
        Update: {
          deleted_at?: string
          deleted_by_email?: string
          deleted_by_uid?: string
          id?: string
          record_id?: string
          record_name?: string | null
          record_type?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          head_of_department_id: string | null
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          description?: string | null
          head_of_department_id?: string | null
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          head_of_department_id?: string | null
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      device_attendance_logs: {
        Row: {
          attendance_record_id: string | null
          company_id: string
          created_at: string | null
          device_id: string | null
          employee_id: string | null
          employee_identifier: string
          id: string
          punch_time: string
          punch_type: string | null
          raw_data: Json | null
          sync_error: string | null
          sync_status: string | null
          synced_at: string | null
        }
        Insert: {
          attendance_record_id?: string | null
          company_id: string
          created_at?: string | null
          device_id?: string | null
          employee_id?: string | null
          employee_identifier: string
          id?: string
          punch_time: string
          punch_type?: string | null
          raw_data?: Json | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
        }
        Update: {
          attendance_record_id?: string | null
          company_id?: string
          created_at?: string | null
          device_id?: string | null
          employee_id?: string | null
          employee_identifier?: string
          id?: string
          punch_time?: string
          punch_type?: string | null
          raw_data?: Json | null
          sync_error?: string | null
          sync_status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_attendance_logs_attendance_record_id_fkey"
            columns: ["attendance_record_id"]
            isOneToOne: false
            referencedRelation: "attendance_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_attendance_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_attendance_logs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "device_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_attendance_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      device_integrations: {
        Row: {
          api_key: string | null
          company_id: string
          connection_type: string
          created_at: string | null
          device_name: string
          device_type: string
          id: string
          ip_address: string | null
          last_sync_at: string | null
          metadata: Json | null
          port: number | null
          status: string | null
          sync_count: number | null
        }
        Insert: {
          api_key?: string | null
          company_id: string
          connection_type: string
          created_at?: string | null
          device_name: string
          device_type: string
          id?: string
          ip_address?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          port?: number | null
          status?: string | null
          sync_count?: number | null
        }
        Update: {
          api_key?: string | null
          company_id?: string
          connection_type?: string
          created_at?: string | null
          device_name?: string
          device_type?: string
          id?: string
          ip_address?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          port?: number | null
          status?: string | null
          sync_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "device_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_documents: {
        Row: {
          access_level: string | null
          category: string
          company_id: string
          created_at: string | null
          expiry_date: string | null
          file_url: string
          id: string
          last_updated_by: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          access_level?: string | null
          category: string
          company_id: string
          created_at?: string | null
          expiry_date?: string | null
          file_url: string
          id?: string
          last_updated_by?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          access_level?: string | null
          category?: string
          company_id?: string
          created_at?: string | null
          expiry_date?: string | null
          file_url?: string
          id?: string
          last_updated_by?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "doc_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doc_documents_last_updated_by_fkey"
            columns: ["last_updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      duty_roster: {
        Row: {
          company_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
          shift_id: number
        }
        Insert: {
          company_id?: string
          created_at?: string
          date: string
          employee_id: string
          id?: string
          notes?: string | null
          shift_id: number
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
          shift_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "duty_roster_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duty_roster_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "org_shift_timings"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_career_timeline: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          employee_id: string
          event_date: string
          event_type: string
          id: string
          metadata: Json | null
          title: string
          visibility: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id: string
          event_date: string
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
          visibility?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id?: string
          event_date?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          title?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_career_timeline_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_compensation_versions: {
        Row: {
          company_id: string
          component_breakdown: Json | null
          created_at: string
          ctc: number
          currency: string | null
          effective_date: string
          employee_id: string
          id: string
          is_active: boolean | null
          reason: string | null
          transition_id: string | null
        }
        Insert: {
          company_id?: string
          component_breakdown?: Json | null
          created_at?: string
          ctc?: number
          currency?: string | null
          effective_date: string
          employee_id: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          transition_id?: string | null
        }
        Update: {
          company_id?: string
          component_breakdown?: Json | null
          created_at?: string
          ctc?: number
          currency?: string | null
          effective_date?: string
          employee_id?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          transition_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_compensation_versions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_compensation_versions_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "employee_job_transitions"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          company_id: string
          created_at: string | null
          document_name: string
          document_type: string
          employee_id: string
          expiry_date: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean | null
          issue_date: string | null
          mime_type: string | null
          notes: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          document_name: string
          document_type?: string
          employee_id: string
          expiry_date?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          issue_date?: string | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          document_name?: string
          document_type?: string
          employee_id?: string
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          issue_date?: string | null
          mime_type?: string | null
          notes?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_fnf_settlements: {
        Row: {
          asset_deduction_amount: number | null
          basic_salary: number | null
          bonus_amount: number | null
          company_id: string | null
          created_at: string | null
          employee_id: string | null
          food_allowance: number | null
          gratuity_amount: number | null
          gratuity_years: number | null
          gross_salary: number | null
          hra_amount: number | null
          id: string
          last_working_day: string | null
          leave_encashment_amount: number | null
          leave_encashment_days: number | null
          loan_advance_deduction: number | null
          net_payable: number | null
          notice_period_days: number | null
          notice_recovery_amount: number | null
          notice_served_days: number | null
          notice_shortfall_days: number | null
          other_allowance: number | null
          other_deductions: number | null
          other_earnings: number | null
          remarks: string | null
          resignation_date: string | null
          service_years: number | null
          special_allowance: number | null
          status: string | null
          total_deductions: number | null
          total_earnings: number | null
          transport_allowance: number | null
          unpaid_salary_amount: number | null
          unpaid_salary_days: number | null
          updated_at: string | null
        }
        Insert: {
          asset_deduction_amount?: number | null
          basic_salary?: number | null
          bonus_amount?: number | null
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          food_allowance?: number | null
          gratuity_amount?: number | null
          gratuity_years?: number | null
          gross_salary?: number | null
          hra_amount?: number | null
          id?: string
          last_working_day?: string | null
          leave_encashment_amount?: number | null
          leave_encashment_days?: number | null
          loan_advance_deduction?: number | null
          net_payable?: number | null
          notice_period_days?: number | null
          notice_recovery_amount?: number | null
          notice_served_days?: number | null
          notice_shortfall_days?: number | null
          other_allowance?: number | null
          other_deductions?: number | null
          other_earnings?: number | null
          remarks?: string | null
          resignation_date?: string | null
          service_years?: number | null
          special_allowance?: number | null
          status?: string | null
          total_deductions?: number | null
          total_earnings?: number | null
          transport_allowance?: number | null
          unpaid_salary_amount?: number | null
          unpaid_salary_days?: number | null
          updated_at?: string | null
        }
        Update: {
          asset_deduction_amount?: number | null
          basic_salary?: number | null
          bonus_amount?: number | null
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          food_allowance?: number | null
          gratuity_amount?: number | null
          gratuity_years?: number | null
          gross_salary?: number | null
          hra_amount?: number | null
          id?: string
          last_working_day?: string | null
          leave_encashment_amount?: number | null
          leave_encashment_days?: number | null
          loan_advance_deduction?: number | null
          net_payable?: number | null
          notice_period_days?: number | null
          notice_recovery_amount?: number | null
          notice_served_days?: number | null
          notice_shortfall_days?: number | null
          other_allowance?: number | null
          other_deductions?: number | null
          other_earnings?: number | null
          remarks?: string | null
          resignation_date?: string | null
          service_years?: number | null
          special_allowance?: number | null
          status?: string | null
          total_deductions?: number | null
          total_earnings?: number | null
          transport_allowance?: number | null
          unpaid_salary_amount?: number | null
          unpaid_salary_days?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_fnf_settlements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_insights: {
        Row: {
          data: Json | null
          employee_id: string | null
          generated_at: string | null
          id: string
          score: number | null
          status: string | null
          type: string
          valid_until: string | null
        }
        Insert: {
          data?: Json | null
          employee_id?: string | null
          generated_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
          type: string
          valid_until?: string | null
        }
        Update: {
          data?: Json | null
          employee_id?: string | null
          generated_at?: string | null
          id?: string
          score?: number | null
          status?: string | null
          type?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_insights_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_job_transitions: {
        Row: {
          approval_date: string | null
          approver_id: string | null
          company_id: string
          created_at: string
          current_data: Json | null
          effective_date: string
          employee_id: string
          id: string
          new_data: Json | null
          reason: string | null
          rejection_reason: string | null
          remarks: string | null
          requester_id: string | null
          status: string | null
          transition_type: string
        }
        Insert: {
          approval_date?: string | null
          approver_id?: string | null
          company_id?: string
          created_at?: string
          current_data?: Json | null
          effective_date: string
          employee_id: string
          id?: string
          new_data?: Json | null
          reason?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          requester_id?: string | null
          status?: string | null
          transition_type: string
        }
        Update: {
          approval_date?: string | null
          approver_id?: string | null
          company_id?: string
          created_at?: string
          current_data?: Json | null
          effective_date?: string
          employee_id?: string
          id?: string
          new_data?: Json | null
          reason?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          requester_id?: string | null
          status?: string | null
          transition_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_job_transitions_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_transitions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_job_transitions_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_leave_authority: {
        Row: {
          approver_level_1: string | null
          approver_level_2: string | null
          approver_level_3: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          is_active: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          approver_level_1?: string | null
          approver_level_2?: string | null
          approver_level_3?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          approver_level_1?: string | null
          approver_level_2?: string | null
          approver_level_3?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_authority_approver_level_1_fkey"
            columns: ["approver_level_1"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_leave_authority_approver_level_2_fkey"
            columns: ["approver_level_2"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_leave_authority_approver_level_3_fkey"
            columns: ["approver_level_3"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_leave_authority_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_leave_balances: {
        Row: {
          calendar_year_id: string | null
          company_id: string
          created_at: string | null
          employee_id: string
          id: string
          leave_type_id: string
          total_balance: number | null
          used: number | null
        }
        Insert: {
          calendar_year_id?: string | null
          company_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          leave_type_id: string
          total_balance?: number | null
          used?: number | null
        }
        Update: {
          calendar_year_id?: string | null
          company_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          leave_type_id?: string
          total_balance?: number | null
          used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_locations: {
        Row: {
          company_id: string | null
          created_at: string | null
          employee_id: string | null
          geofence_radius_meters: number | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          latitude: number
          location_name: string
          longitude: number
          radius_meters: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          geofence_radius_meters?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          latitude: number
          location_name: string
          longitude: number
          radius_meters?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          employee_id?: string | null
          geofence_radius_meters?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          latitude?: number
          location_name?: string
          longitude?: number
          radius_meters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_locations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_ot_authority: {
        Row: {
          approver_level_1: string | null
          approver_level_2: string | null
          approver_level_3: string | null
          company_id: string
          created_at: string | null
          created_by: string | null
          effective_from: string
          effective_to: string | null
          employee_id: string
          id: string
          is_active: boolean
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          approver_level_1?: string | null
          approver_level_2?: string | null
          approver_level_3?: string | null
          company_id: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          approver_level_1?: string | null
          approver_level_2?: string | null
          approver_level_3?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_ot_authority_approver_level_1_fkey"
            columns: ["approver_level_1"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_ot_authority_approver_level_2_fkey"
            columns: ["approver_level_2"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_ot_authority_approver_level_3_fkey"
            columns: ["approver_level_3"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_ot_authority_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_ot_authority_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_salary_components: {
        Row: {
          amount: number | null
          company_id: string
          component_name: string | null
          component_type: string | null
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          employee_id: string
          id: string
          is_active: boolean | null
          remarks: string | null
          salary_component_id: number | null
        }
        Insert: {
          amount?: number | null
          company_id: string
          component_name?: string | null
          component_type?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          employee_id: string
          id?: string
          is_active?: boolean | null
          remarks?: string | null
          salary_component_id?: number | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          component_name?: string | null
          component_type?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          employee_id?: string
          id?: string
          is_active?: boolean | null
          remarks?: string | null
          salary_component_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_salary_components_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_salary_components_salary_component_id_fkey"
            columns: ["salary_component_id"]
            isOneToOne: false
            referencedRelation: "org_salary_components"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_skills: {
        Row: {
          created_at: string | null
          employee_id: string | null
          id: string
          proficiency_level: number | null
          skill_id: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          id?: string
          proficiency_level?: number | null
          skill_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          id?: string
          proficiency_level?: number | null
          skill_id?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_skills_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "org_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_targets: {
        Row: {
          achieved_amount: number | null
          company_id: string
          created_at: string | null
          employee_id: string
          id: string
          incentive_rate: number | null
          target_amount: number
          target_period: string
          target_period_val: number
          target_year: number
        }
        Insert: {
          achieved_amount?: number | null
          company_id?: string
          created_at?: string | null
          employee_id: string
          id?: string
          incentive_rate?: number | null
          target_amount?: number
          target_period: string
          target_period_val: number
          target_year: number
        }
        Update: {
          achieved_amount?: number | null
          company_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          incentive_rate?: number | null
          target_amount?: number
          target_period?: string
          target_period_val?: number
          target_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_targets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          account_number: string | null
          age: number | null
          air_ticket: string | null
          annual_leave_duration_policy: string | null
          bank_name: string | null
          blood_group_id: number | null
          client_name: string | null
          company_id: string
          created_at: string
          current_address: string | null
          date_of_birth: string | null
          department: string | null
          department_id: number | null
          designation: string | null
          designation_id: number | null
          documents: Json | null
          driving_licence_expiry: string | null
          driving_licence_number: string | null
          email: string | null
          employee_code: string | null
          employee_status_id: number | null
          employment_type_id: number | null
          faith_id: number | null
          gender: string | null
          geo_latitude: number | null
          geo_longitude: number | null
          geofence_radius_meters: number | null
          gps_punch_enabled: boolean | null
          grade_id: number | null
          hamad_card_expiry: string | null
          health_card_expiry: string | null
          health_card_number: string | null
          id: string
          ifsc_code: string | null
          join_date: string | null
          labour_card_expiry: string | null
          labour_card_number: string | null
          leave_balance: Json | null
          leave_plan_id: number | null
          location_id: number | null
          manager_id: string | null
          marital_status_id: number | null
          memo: string | null
          name: string
          nationality: string | null
          nationality_id: number | null
          office_email: string | null
          office_mobile: string | null
          ot_allowance_mapped_component_id: number | null
          ot_applicable: boolean | null
          ot_calculation_basis: string | null
          ot_deduction_mapped_component_id: number | null
          ot_rate_multiplier: number | null
          passport_expiry: string | null
          passport_number: string | null
          pay_group_id: number | null
          permanent_address: string | null
          personal_email: string | null
          personal_mobile: string | null
          phone: string | null
          profile_id: string | null
          profile_photo_url: string | null
          punch_mode: string | null
          qid_expiry: string | null
          qid_number: string | null
          radius_meters: number | null
          remarks: string | null
          role: string | null
          role_id: string | null
          salary_amount: number | null
          salary_remarks: string | null
          shift_timing_id: number | null
          status: string | null
          ticket_frequency: string | null
          user_account_linked: boolean | null
          visa_expiry: string | null
          visa_number: string | null
          visa_sponsor: string | null
          visa_type: string | null
          visa_type_id: number | null
          weekoff_rule_id: number | null
        }
        Insert: {
          account_number?: string | null
          age?: number | null
          air_ticket?: string | null
          annual_leave_duration_policy?: string | null
          bank_name?: string | null
          blood_group_id?: number | null
          client_name?: string | null
          company_id?: string
          created_at?: string
          current_address?: string | null
          date_of_birth?: string | null
          department?: string | null
          department_id?: number | null
          designation?: string | null
          designation_id?: number | null
          documents?: Json | null
          driving_licence_expiry?: string | null
          driving_licence_number?: string | null
          email?: string | null
          employee_code?: string | null
          employee_status_id?: number | null
          employment_type_id?: number | null
          faith_id?: number | null
          gender?: string | null
          geo_latitude?: number | null
          geo_longitude?: number | null
          geofence_radius_meters?: number | null
          gps_punch_enabled?: boolean | null
          grade_id?: number | null
          hamad_card_expiry?: string | null
          health_card_expiry?: string | null
          health_card_number?: string | null
          id?: string
          ifsc_code?: string | null
          join_date?: string | null
          labour_card_expiry?: string | null
          labour_card_number?: string | null
          leave_balance?: Json | null
          leave_plan_id?: number | null
          location_id?: number | null
          manager_id?: string | null
          marital_status_id?: number | null
          memo?: string | null
          name: string
          nationality?: string | null
          nationality_id?: number | null
          office_email?: string | null
          office_mobile?: string | null
          ot_allowance_mapped_component_id?: number | null
          ot_applicable?: boolean | null
          ot_calculation_basis?: string | null
          ot_deduction_mapped_component_id?: number | null
          ot_rate_multiplier?: number | null
          passport_expiry?: string | null
          passport_number?: string | null
          pay_group_id?: number | null
          permanent_address?: string | null
          personal_email?: string | null
          personal_mobile?: string | null
          phone?: string | null
          profile_id?: string | null
          profile_photo_url?: string | null
          punch_mode?: string | null
          qid_expiry?: string | null
          qid_number?: string | null
          radius_meters?: number | null
          remarks?: string | null
          role?: string | null
          role_id?: string | null
          salary_amount?: number | null
          salary_remarks?: string | null
          shift_timing_id?: number | null
          status?: string | null
          ticket_frequency?: string | null
          user_account_linked?: boolean | null
          visa_expiry?: string | null
          visa_number?: string | null
          visa_sponsor?: string | null
          visa_type?: string | null
          visa_type_id?: number | null
          weekoff_rule_id?: number | null
        }
        Update: {
          account_number?: string | null
          age?: number | null
          air_ticket?: string | null
          annual_leave_duration_policy?: string | null
          bank_name?: string | null
          blood_group_id?: number | null
          client_name?: string | null
          company_id?: string
          created_at?: string
          current_address?: string | null
          date_of_birth?: string | null
          department?: string | null
          department_id?: number | null
          designation?: string | null
          designation_id?: number | null
          documents?: Json | null
          driving_licence_expiry?: string | null
          driving_licence_number?: string | null
          email?: string | null
          employee_code?: string | null
          employee_status_id?: number | null
          employment_type_id?: number | null
          faith_id?: number | null
          gender?: string | null
          geo_latitude?: number | null
          geo_longitude?: number | null
          geofence_radius_meters?: number | null
          gps_punch_enabled?: boolean | null
          grade_id?: number | null
          hamad_card_expiry?: string | null
          health_card_expiry?: string | null
          health_card_number?: string | null
          id?: string
          ifsc_code?: string | null
          join_date?: string | null
          labour_card_expiry?: string | null
          labour_card_number?: string | null
          leave_balance?: Json | null
          leave_plan_id?: number | null
          location_id?: number | null
          manager_id?: string | null
          marital_status_id?: number | null
          memo?: string | null
          name?: string
          nationality?: string | null
          nationality_id?: number | null
          office_email?: string | null
          office_mobile?: string | null
          ot_allowance_mapped_component_id?: number | null
          ot_applicable?: boolean | null
          ot_calculation_basis?: string | null
          ot_deduction_mapped_component_id?: number | null
          ot_rate_multiplier?: number | null
          passport_expiry?: string | null
          passport_number?: string | null
          pay_group_id?: number | null
          permanent_address?: string | null
          personal_email?: string | null
          personal_mobile?: string | null
          phone?: string | null
          profile_id?: string | null
          profile_photo_url?: string | null
          punch_mode?: string | null
          qid_expiry?: string | null
          qid_number?: string | null
          radius_meters?: number | null
          remarks?: string | null
          role?: string | null
          role_id?: string | null
          salary_amount?: number | null
          salary_remarks?: string | null
          shift_timing_id?: number | null
          status?: string | null
          ticket_frequency?: string | null
          user_account_linked?: boolean | null
          visa_expiry?: string | null
          visa_number?: string | null
          visa_sponsor?: string | null
          visa_type?: string | null
          visa_type_id?: number | null
          weekoff_rule_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_blood_group_id_fkey"
            columns: ["blood_group_id"]
            isOneToOne: false
            referencedRelation: "org_blood_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "org_designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employee_status_id_fkey"
            columns: ["employee_status_id"]
            isOneToOne: false
            referencedRelation: "org_employee_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_employment_type_id_fkey"
            columns: ["employment_type_id"]
            isOneToOne: false
            referencedRelation: "org_employment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_faith_id_fkey"
            columns: ["faith_id"]
            isOneToOne: false
            referencedRelation: "org_faiths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_grade_id_fkey"
            columns: ["grade_id"]
            isOneToOne: false
            referencedRelation: "org_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_leave_plan_id_fkey"
            columns: ["leave_plan_id"]
            isOneToOne: false
            referencedRelation: "org_leave_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_marital_status_id_fkey"
            columns: ["marital_status_id"]
            isOneToOne: false
            referencedRelation: "org_marital_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_nationality_id_fkey"
            columns: ["nationality_id"]
            isOneToOne: false
            referencedRelation: "org_nationalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_ot_allowance_mapped_component_id_fkey"
            columns: ["ot_allowance_mapped_component_id"]
            isOneToOne: false
            referencedRelation: "org_salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_ot_deduction_mapped_component_id_fkey"
            columns: ["ot_deduction_mapped_component_id"]
            isOneToOne: false
            referencedRelation: "org_salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_pay_group_id_fkey"
            columns: ["pay_group_id"]
            isOneToOne: false
            referencedRelation: "org_pay_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_visa_type_id_fkey"
            columns: ["visa_type_id"]
            isOneToOne: false
            referencedRelation: "org_visa_types"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          description: string | null
          employee_id: string | null
          id: string
          reason: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          reason?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          reason?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_masters_cost_centers: {
        Row: {
          code: string
          company_id: string
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
        }
        Insert: {
          code: string
          company_id?: string
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_masters_cost_centers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "financial_masters_cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_masters_currencies: {
        Row: {
          code: string
          company_id: string
          id: string
          is_active: boolean | null
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          company_id?: string
          id?: string
          is_active?: boolean | null
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      financial_masters_exchange_rates: {
        Row: {
          company_id: string
          effective_date: string
          from_currency: string
          id: string
          rate: number
          to_currency: string
        }
        Insert: {
          company_id?: string
          effective_date?: string
          from_currency: string
          id?: string
          rate: number
          to_currency: string
        }
        Update: {
          company_id?: string
          effective_date?: string
          from_currency?: string
          id?: string
          rate?: number
          to_currency?: string
        }
        Relationships: []
      }
      fiscal_years: {
        Row: {
          company_id: string
          created_at: string
          end_date: string
          id: string
          is_closed: boolean | null
          name: string
          start_date: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          end_date: string
          id?: string
          is_closed?: boolean | null
          name: string
          start_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          is_closed?: boolean | null
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      fixed_asset_depreciation: {
        Row: {
          amount: number
          asset_id: string
          company_id: string
          created_at: string
          id: string
          journal_entry_id: string | null
          notes: string | null
          period_date: string
        }
        Insert: {
          amount: number
          asset_id: string
          company_id?: string
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          period_date: string
        }
        Update: {
          amount?: number
          asset_id?: string
          company_id?: string
          created_at?: string
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          period_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_asset_depreciation_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_asset_depreciation_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_assets: {
        Row: {
          account_id: string | null
          accumulated_depreciation: number
          asset_code: string | null
          category: string
          company_id: string
          created_at: string
          depreciation_account_id: string | null
          depreciation_method: string
          description: string | null
          disposal_date: string | null
          disposal_value: number | null
          id: string
          location: string | null
          name: string
          net_book_value: number | null
          purchase_date: string
          purchase_value: number
          salvage_value: number
          status: string
          supplier: string | null
          useful_life_years: number
          warranty_expiry: string | null
        }
        Insert: {
          account_id?: string | null
          accumulated_depreciation?: number
          asset_code?: string | null
          category?: string
          company_id?: string
          created_at?: string
          depreciation_account_id?: string | null
          depreciation_method?: string
          description?: string | null
          disposal_date?: string | null
          disposal_value?: number | null
          id?: string
          location?: string | null
          name: string
          net_book_value?: number | null
          purchase_date: string
          purchase_value?: number
          salvage_value?: number
          status?: string
          supplier?: string | null
          useful_life_years?: number
          warranty_expiry?: string | null
        }
        Update: {
          account_id?: string | null
          accumulated_depreciation?: number
          asset_code?: string | null
          category?: string
          company_id?: string
          created_at?: string
          depreciation_account_id?: string | null
          depreciation_method?: string
          description?: string | null
          disposal_date?: string | null
          disposal_value?: number | null
          id?: string
          location?: string | null
          name?: string
          net_book_value?: number | null
          purchase_date?: string
          purchase_value?: number
          salvage_value?: number
          status?: string
          supplier?: string | null
          useful_life_years?: number
          warranty_expiry?: string | null
        }
        Relationships: []
      }
      grni_reconciliation: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          grn_reference_id: string | null
          id: string
          invoice_reference_id: string | null
          po_reference: string
          status: string | null
        }
        Insert: {
          amount: number
          company_id?: string
          created_at?: string
          grn_reference_id?: string | null
          id?: string
          invoice_reference_id?: string | null
          po_reference: string
          status?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          grn_reference_id?: string | null
          id?: string
          invoice_reference_id?: string | null
          po_reference?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grni_reconciliation_grn_reference_id_fkey"
            columns: ["grn_reference_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_companies: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          status: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      holidays: {
        Row: {
          applicable_to: string | null
          company_id: string
          created_at: string | null
          date: string
          id: string
          is_recurring: boolean | null
          name: string
          type: string
        }
        Insert: {
          applicable_to?: string | null
          company_id: string
          created_at?: string | null
          date: string
          id?: string
          is_recurring?: boolean | null
          name: string
          type?: string
        }
        Update: {
          applicable_to?: string | null
          company_id?: string
          created_at?: string | null
          date?: string
          id?: string
          is_recurring?: boolean | null
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_airfare_tickets: {
        Row: {
          airline: string | null
          arrival: string
          company_id: string
          cost: number
          created_at: string | null
          departure: string
          departure_date: string
          employee_id: string
          id: string
          remarks: string | null
          return_date: string | null
          status: string
          ticket_doc_url: string | null
          ticket_number: string | null
          trip_type: string
          updated_at: string | null
        }
        Insert: {
          airline?: string | null
          arrival: string
          company_id: string
          cost?: number
          created_at?: string | null
          departure: string
          departure_date: string
          employee_id: string
          id?: string
          remarks?: string | null
          return_date?: string | null
          status?: string
          ticket_doc_url?: string | null
          ticket_number?: string | null
          trip_type?: string
          updated_at?: string | null
        }
        Update: {
          airline?: string | null
          arrival?: string
          company_id?: string
          cost?: number
          created_at?: string | null
          departure?: string
          departure_date?: string
          employee_id?: string
          id?: string
          remarks?: string | null
          return_date?: string | null
          status?: string
          ticket_doc_url?: string | null
          ticket_number?: string | null
          trip_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hrms_airfare_tickets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_airfare_tickets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_benefit_claims: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          benefit_id: string | null
          claim_amount: number
          claim_date: string
          company_id: string
          created_at: string
          description: string | null
          employee_id: string
          id: string
          receipt_url: string | null
          status: string
          updated_at: string
          workflow_instance_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          benefit_id?: string | null
          claim_amount: number
          claim_date?: string
          company_id: string
          created_at?: string
          description?: string | null
          employee_id: string
          id?: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          benefit_id?: string | null
          claim_amount?: number
          claim_date?: string
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id?: string
          id?: string
          receipt_url?: string | null
          status?: string
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hrms_benefit_claims_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_benefit_claims_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "hrms_benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_benefit_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_benefit_claims_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_benefits: {
        Row: {
          annual_limit: number | null
          balance: number | null
          benefit_type: string
          company_contribution: number | null
          company_id: string
          coverage_details: Json | null
          created_at: string
          employee_contribution: number | null
          employee_id: string
          id: string
          status: string
          tier_name: string
          updated_at: string
        }
        Insert: {
          annual_limit?: number | null
          balance?: number | null
          benefit_type: string
          company_contribution?: number | null
          company_id: string
          coverage_details?: Json | null
          created_at?: string
          employee_contribution?: number | null
          employee_id: string
          id?: string
          status?: string
          tier_name: string
          updated_at?: string
        }
        Update: {
          annual_limit?: number | null
          balance?: number | null
          benefit_type?: string
          company_contribution?: number | null
          company_id?: string
          coverage_details?: Json | null
          created_at?: string
          employee_contribution?: number | null
          employee_id?: string
          id?: string
          status?: string
          tier_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrms_benefits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_benefits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_perf_cycles: {
        Row: {
          company_id: string
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrms_perf_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_perf_goals: {
        Row: {
          company_id: string
          created_at: string
          current_value: number | null
          description: string | null
          due_date: string
          employee_id: string
          id: string
          status: string
          target_value: number
          title: string
          unit: string | null
          updated_at: string
          weightage: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          current_value?: number | null
          description?: string | null
          due_date: string
          employee_id: string
          id?: string
          status?: string
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string
          weightage?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          current_value?: number | null
          description?: string | null
          due_date?: string
          employee_id?: string
          id?: string
          status?: string
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string
          weightage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hrms_perf_goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_perf_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_perf_reviews: {
        Row: {
          company_id: string
          created_at: string
          cycle_id: string
          employee_id: string
          final_rating: number | null
          id: string
          manager_comments: string | null
          manager_rating: number | null
          self_comments: string | null
          self_rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          cycle_id: string
          employee_id: string
          final_rating?: number | null
          id?: string
          manager_comments?: string | null
          manager_rating?: number | null
          self_comments?: string | null
          self_rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          cycle_id?: string
          employee_id?: string
          final_rating?: number | null
          id?: string
          manager_comments?: string | null
          manager_rating?: number | null
          self_comments?: string | null
          self_rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrms_perf_reviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_perf_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "hrms_perf_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_perf_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_travel_expenses: {
        Row: {
          amount: number
          category: string
          company_id: string
          created_at: string
          currency: string | null
          description: string | null
          exchange_rate: number | null
          expense_date: string
          id: string
          receipt_url: string | null
          status: string
          travel_request_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          company_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
          status?: string
          travel_request_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          exchange_rate?: number | null
          expense_date?: string
          id?: string
          receipt_url?: string | null
          status?: string
          travel_request_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hrms_travel_expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_travel_expenses_travel_request_id_fkey"
            columns: ["travel_request_id"]
            isOneToOne: false
            referencedRelation: "hrms_travel_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hrms_travel_requests: {
        Row: {
          company_id: string
          created_at: string
          departure_date: string
          destination: string
          employee_id: string
          estimated_cost: number | null
          flight_details: string | null
          hotel_details: string | null
          id: string
          need_flight: boolean | null
          need_hotel: boolean | null
          purpose: string
          return_date: string
          status: string
          updated_at: string
          workflow_instance_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          departure_date: string
          destination: string
          employee_id: string
          estimated_cost?: number | null
          flight_details?: string | null
          hotel_details?: string | null
          id?: string
          need_flight?: boolean | null
          need_hotel?: boolean | null
          purpose: string
          return_date: string
          status?: string
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          departure_date?: string
          destination?: string
          employee_id?: string
          estimated_cost?: number | null
          flight_details?: string | null
          hotel_details?: string | null
          id?: string
          need_flight?: boolean | null
          need_hotel?: boolean | null
          purpose?: string
          return_date?: string
          status?: string
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hrms_travel_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hrms_travel_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_account_config: {
        Row: {
          category: string | null
          cogs_account: string
          company_id: string
          created_at: string
          grni_account: string
          id: string
          inventory_asset_account: string
          stock_adjustment_account: string
        }
        Insert: {
          category?: string | null
          cogs_account: string
          company_id?: string
          created_at?: string
          grni_account: string
          id?: string
          inventory_asset_account: string
          stock_adjustment_account: string
        }
        Update: {
          category?: string | null
          cogs_account?: string
          company_id?: string
          created_at?: string
          grni_account?: string
          id?: string
          inventory_asset_account?: string
          stock_adjustment_account?: string
        }
        Relationships: []
      }
      inventory_adjustment_lines: {
        Row: {
          adjustment_id: string | null
          batch_number: string | null
          bin_id: string | null
          company_id: string
          counted_qty: number
          created_at: string
          difference_qty: number | null
          id: string
          item_id: string
          justification: string | null
          system_qty: number
        }
        Insert: {
          adjustment_id?: string | null
          batch_number?: string | null
          bin_id?: string | null
          company_id?: string
          counted_qty?: number
          created_at?: string
          difference_qty?: number | null
          id?: string
          item_id: string
          justification?: string | null
          system_qty?: number
        }
        Update: {
          adjustment_id?: string | null
          batch_number?: string | null
          bin_id?: string | null
          company_id?: string
          counted_qty?: number
          created_at?: string
          difference_qty?: number | null
          id?: string
          item_id?: string
          justification?: string | null
          system_qty?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustment_lines_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "inventory_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustment_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjustment_date: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          reason_id: string
          reference_number: string | null
          status: string | null
          warehouse_id: string
        }
        Insert: {
          adjustment_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reason_id: string
          reference_number?: string | null
          status?: string | null
          warehouse_id: string
        }
        Update: {
          adjustment_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reason_id?: string
          reference_number?: string | null
          status?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_reason_id_fkey"
            columns: ["reason_id"]
            isOneToOne: false
            referencedRelation: "inventory_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reasons: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      inventory_reservations: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string | null
          reference_id: string
          reference_type: string
          reserved_qty: number
          status: string | null
          warehouse_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          reference_id: string
          reference_type: string
          reserved_qty: number
          status?: string | null
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          reference_id?: string
          reference_type?: string
          reserved_qty?: number
          status?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inv_res_warehouse"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          batch_number: string | null
          company_id: string
          created_at: string
          id: string
          item_id: string | null
          posting_date: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          serial_number: string | null
          total_value: number | null
          transaction_type: string
          unit_cost: number | null
          warehouse_id: string | null
        }
        Insert: {
          batch_number?: string | null
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          posting_date?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          serial_number?: string | null
          total_value?: number | null
          transaction_type: string
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Update: {
          batch_number?: string | null
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string | null
          posting_date?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          serial_number?: string | null
          total_value?: number | null
          transaction_type?: string
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inv_txn_warehouse"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      item_master: {
        Row: {
          barcode: string | null
          category: string | null
          code: string
          company_id: string
          created_at: string
          default_bom_id: string | null
          description: string | null
          expense_account_id: string | null
          expiry_date: string | null
          id: string
          image_urls: Json | null
          income_account_id: string | null
          is_batch_tracked: boolean | null
          is_manufactured: boolean | null
          is_serial_tracked: boolean | null
          is_stockable: boolean | null
          is_subcontracted: boolean | null
          name: string
          photo_url: string | null
          picking_method: string | null
          putaway_strategy: string | null
          reorder_level: number | null
          reorder_qty: number | null
          status: string | null
          storage_category_id: string | null
          uom: string
          valuation_method: string | null
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          code: string
          company_id?: string
          created_at?: string
          default_bom_id?: string | null
          description?: string | null
          expense_account_id?: string | null
          expiry_date?: string | null
          id?: string
          image_urls?: Json | null
          income_account_id?: string | null
          is_batch_tracked?: boolean | null
          is_manufactured?: boolean | null
          is_serial_tracked?: boolean | null
          is_stockable?: boolean | null
          is_subcontracted?: boolean | null
          name: string
          photo_url?: string | null
          picking_method?: string | null
          putaway_strategy?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          status?: string | null
          storage_category_id?: string | null
          uom: string
          valuation_method?: string | null
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string
          default_bom_id?: string | null
          description?: string | null
          expense_account_id?: string | null
          expiry_date?: string | null
          id?: string
          image_urls?: Json | null
          income_account_id?: string | null
          is_batch_tracked?: boolean | null
          is_manufactured?: boolean | null
          is_serial_tracked?: boolean | null
          is_stockable?: boolean | null
          is_subcontracted?: boolean | null
          name?: string
          photo_url?: string | null
          picking_method?: string | null
          putaway_strategy?: string | null
          reorder_level?: number | null
          reorder_qty?: number | null
          status?: string | null
          storage_category_id?: string | null
          uom?: string
          valuation_method?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_master_default_bom_id_fkey"
            columns: ["default_bom_id"]
            isOneToOne: false
            referencedRelation: "mrp_bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_master_expense_account_id_fkey"
            columns: ["expense_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_master_income_account_id_fkey"
            columns: ["income_account_id"]
            isOneToOne: false
            referencedRelation: "accounting_chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_master_storage_category_id_fkey"
            columns: ["storage_category_id"]
            isOneToOne: false
            referencedRelation: "storage_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      journals: {
        Row: {
          code: string
          company_id: string
          created_at: string
          default_account_id: string | null
          id: string
          name: string
          sequence_prefix: string | null
          type: string
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          default_account_id?: string | null
          id?: string
          name: string
          sequence_prefix?: string | null
          type: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          default_account_id?: string | null
          id?: string
          name?: string
          sequence_prefix?: string | null
          type?: string
        }
        Relationships: []
      }
      kudos_rewards: {
        Row: {
          category_id: number | null
          company_id: string
          created_at: string
          id: string
          is_public: boolean | null
          message: string | null
          receiver_id: string | null
          sender_id: string | null
        }
        Insert: {
          category_id?: number | null
          company_id?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          message?: string | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Update: {
          category_id?: number | null
          company_id?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          message?: string | null
          receiver_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kudos_rewards_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "master_kudos_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kudos_rewards_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kudos_rewards_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_batch_items: {
        Row: {
          batch_id: string
          company_id: string
          created_at: string
          id: string
          order_item_id: string
        }
        Insert: {
          batch_id: string
          company_id?: string
          created_at?: string
          id?: string
          order_item_id: string
        }
        Update: {
          batch_id?: string
          company_id?: string
          created_at?: string
          id?: string
          order_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "laundry_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_batch_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_batch_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "laundry_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_batches: {
        Row: {
          batch_number: string
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          machine_id: string | null
          operator_id: string | null
          stage: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          batch_number: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          operator_id?: string | null
          stage?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          batch_number?: string
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          machine_id?: string | null
          operator_id?: string | null
          stage?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_batches_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "laundry_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_batches_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_client_employees: {
        Row: {
          building_no: string | null
          client_customer_id: string
          company_id: string
          created_at: string
          employee_no: string
          id: string
          mobile: string | null
          name: string
          room_no: string | null
          status: string | null
        }
        Insert: {
          building_no?: string | null
          client_customer_id: string
          company_id?: string
          created_at?: string
          employee_no: string
          id?: string
          mobile?: string | null
          name: string
          room_no?: string | null
          status?: string | null
        }
        Update: {
          building_no?: string | null
          client_customer_id?: string
          company_id?: string
          created_at?: string
          employee_no?: string
          id?: string
          mobile?: string | null
          name?: string
          room_no?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_client_employees_client_customer_id_fkey"
            columns: ["client_customer_id"]
            isOneToOne: false
            referencedRelation: "laundry_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_client_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_contracts: {
        Row: {
          company_id: string
          contract_number: string
          created_at: string
          customer_id: string
          discount_percentage: number
          end_date: string
          id: string
          monthly_limit: number
          sla_days: number
          start_date: string
          status: string | null
        }
        Insert: {
          company_id?: string
          contract_number: string
          created_at?: string
          customer_id: string
          discount_percentage?: number
          end_date: string
          id?: string
          monthly_limit?: number
          sla_days?: number
          start_date: string
          status?: string | null
        }
        Update: {
          company_id?: string
          contract_number?: string
          created_at?: string
          customer_id?: string
          discount_percentage?: number
          end_date?: string
          id?: string
          monthly_limit?: number
          sla_days?: number
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "laundry_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_customers: {
        Row: {
          company_id: string
          created_at: string
          email: string | null
          id: string
          mobile: string | null
          name: string
          status: string | null
          type: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name: string
          status?: string | null
          type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          mobile?: string | null
          name?: string
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_deliveries: {
        Row: {
          company_id: string
          created_at: string
          delivery_date: string | null
          driver_id: string | null
          id: string
          notes: string | null
          order_id: string
          route_details: string | null
          status: string | null
          vehicle_details: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          delivery_date?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id: string
          route_details?: string | null
          status?: string | null
          vehicle_details?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_date?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          route_details?: string | null
          status?: string | null
          vehicle_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_deliveries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laundry_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_driver_shifts: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string
          id: string
          shift_date: string
          shift_type: string
          status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          driver_id: string
          id?: string
          shift_date: string
          shift_type: string
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string
          id?: string
          shift_date?: string
          shift_type?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_driver_shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_driver_shifts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_feedback: {
        Row: {
          comments: string | null
          company_id: string
          created_at: string
          customer_id: string
          id: string
          order_id: string
          rating: number
          status: string | null
        }
        Insert: {
          comments?: string | null
          company_id?: string
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          rating: number
          status?: string | null
        }
        Update: {
          comments?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          rating?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_feedback_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "laundry_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_feedback_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laundry_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_fuel_logs: {
        Row: {
          company_id: string
          cost: number
          created_at: string
          date: string
          id: string
          liters: number
          odometer: number
          vehicle_id: string
        }
        Insert: {
          company_id?: string
          cost: number
          created_at?: string
          date?: string
          id?: string
          liters: number
          odometer: number
          vehicle_id: string
        }
        Update: {
          company_id?: string
          cost?: number
          created_at?: string
          date?: string
          id?: string
          liters?: number
          odometer?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_fuel_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_fuel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "laundry_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_gps_history: {
        Row: {
          company_id: string
          created_at: string
          id: string
          job_id: string
          job_type: string
          latitude: number
          longitude: number
          speed: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          job_id: string
          job_type: string
          latitude: number
          longitude: number
          speed?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string
          job_type?: string
          latitude?: number
          longitude?: number
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_gps_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_items: {
        Row: {
          category: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          status: string | null
        }
        Insert: {
          category?: string | null
          code: string
          company_id?: string
          created_at?: string
          id?: string
          name: string
          status?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_machine_logs: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          event_type: string | null
          id: string
          machine_id: string
          performed_by: string | null
          run_hours: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          event_type?: string | null
          id?: string
          machine_id: string
          performed_by?: string | null
          run_hours?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          event_type?: string | null
          id?: string
          machine_id?: string
          performed_by?: string | null
          run_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_machine_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_machine_logs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "laundry_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_machines: {
        Row: {
          branch_id: number | null
          capacity: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          status: string | null
          type: string | null
          utilization: number | null
        }
        Insert: {
          branch_id?: number | null
          capacity?: string | null
          code: string
          company_id?: string
          created_at?: string
          id?: string
          name: string
          status?: string | null
          type?: string | null
          utilization?: number | null
        }
        Update: {
          branch_id?: number | null
          capacity?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: string | null
          type?: string | null
          utilization?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_machines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_machines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_maintenance: {
        Row: {
          company_id: string
          cost: number
          created_at: string
          description: string | null
          id: string
          machine_id: string
          performed_at: string
          technician_name: string | null
          type: string
        }
        Insert: {
          company_id?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          machine_id: string
          performed_at?: string
          technician_name?: string | null
          type: string
        }
        Update: {
          company_id?: string
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          machine_id?: string
          performed_at?: string
          technician_name?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_maintenance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_maintenance_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "laundry_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_order_items: {
        Row: {
          barcode: string | null
          company_id: string
          created_at: string
          id: string
          item_id: string
          notes: string | null
          order_id: string
          qty_ack: number | null
          qty_issued: number | null
          qty_recv: number | null
          qty_ret: number | null
          quantity: number
          service_id: string
          status: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          barcode?: string | null
          company_id?: string
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          order_id: string
          qty_ack?: number | null
          qty_issued?: number | null
          qty_recv?: number | null
          qty_ret?: number | null
          quantity?: number
          service_id: string
          status?: string | null
          total_price?: number
          unit_price?: number
        }
        Update: {
          barcode?: string | null
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          order_id?: string
          qty_ack?: number | null
          qty_issued?: number | null
          qty_recv?: number | null
          qty_ret?: number | null
          quantity?: number
          service_id?: string
          status?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "laundry_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "laundry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laundry_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_order_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "laundry_services"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_orders: {
        Row: {
          accounting_invoice_id: string | null
          branch_id: number | null
          building_no: string | null
          channel: string | null
          client_employee_name: string | null
          client_employee_no: string | null
          client_mobile: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          discount_amount: number | null
          due_date: string | null
          id: string
          notes: string | null
          order_number: string
          payment_status: string | null
          priority: string | null
          receipt_no: string | null
          room_no: string | null
          staff_employee_name: string | null
          status: string | null
          tax_amount: number | null
          total_amount: number | null
        }
        Insert: {
          accounting_invoice_id?: string | null
          branch_id?: number | null
          building_no?: string | null
          channel?: string | null
          client_employee_name?: string | null
          client_employee_no?: string | null
          client_mobile?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_status?: string | null
          priority?: string | null
          receipt_no?: string | null
          room_no?: string | null
          staff_employee_name?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount?: number | null
        }
        Update: {
          accounting_invoice_id?: string | null
          branch_id?: number | null
          building_no?: string | null
          channel?: string | null
          client_employee_name?: string | null
          client_employee_no?: string | null
          client_mobile?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_status?: string | null
          priority?: string | null
          receipt_no?: string | null
          room_no?: string | null
          staff_employee_name?: string | null
          status?: string | null
          tax_amount?: number | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "laundry_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_pickups: {
        Row: {
          company_id: string
          created_at: string
          driver_id: string | null
          id: string
          notes: string | null
          order_id: string
          pickup_date: string | null
          route_details: string | null
          status: string | null
          vehicle_details: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id: string
          pickup_date?: string | null
          route_details?: string | null
          status?: string | null
          vehicle_details?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          pickup_date?: string | null
          route_details?: string | null
          status?: string | null
          vehicle_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_pickups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_pickups_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_pickups_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laundry_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_pricing: {
        Row: {
          branch_id: number | null
          company_id: string
          created_at: string
          express_price: number
          id: string
          item_id: string
          service_id: string
          status: string | null
          unit_price: number
        }
        Insert: {
          branch_id?: number | null
          company_id?: string
          created_at?: string
          express_price?: number
          id?: string
          item_id: string
          service_id: string
          status?: string | null
          unit_price?: number
        }
        Update: {
          branch_id?: number | null
          company_id?: string
          created_at?: string
          express_price?: number
          id?: string
          item_id?: string
          service_id?: string
          status?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "laundry_pricing_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_pricing_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_pricing_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "laundry_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_pricing_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "laundry_services"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_quality_logs: {
        Row: {
          check_status: string
          comments: string | null
          company_id: string
          created_at: string
          damage_found: boolean | null
          id: string
          inspector_id: string | null
          order_item_id: string
          stain_removed: boolean | null
        }
        Insert: {
          check_status: string
          comments?: string | null
          company_id?: string
          created_at?: string
          damage_found?: boolean | null
          id?: string
          inspector_id?: string | null
          order_item_id: string
          stain_removed?: boolean | null
        }
        Update: {
          check_status?: string
          comments?: string | null
          company_id?: string
          created_at?: string
          damage_found?: boolean | null
          id?: string
          inspector_id?: string | null
          order_item_id?: string
          stain_removed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_quality_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_quality_logs_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_quality_logs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "laundry_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_services: {
        Row: {
          category: string | null
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string | null
        }
        Insert: {
          category?: string | null
          code: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_status_history: {
        Row: {
          company_id: string
          created_at: string
          from_status: string | null
          id: string
          notes: string | null
          order_id: string
          performed_by: string | null
          to_status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id: string
          performed_by?: string | null
          to_status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          performed_by?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "laundry_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_vehicles: {
        Row: {
          branch_id: number | null
          company_id: string
          created_at: string
          current_mileage: number
          fuel_capacity: number
          id: string
          insurance_expiry: string | null
          license_plate: string
          name: string
          status: string | null
          type: string
        }
        Insert: {
          branch_id?: number | null
          company_id?: string
          created_at?: string
          current_mileage?: number
          fuel_capacity?: number
          id?: string
          insurance_expiry?: string | null
          license_plate: string
          name: string
          status?: string | null
          type: string
        }
        Update: {
          branch_id?: number | null
          company_id?: string
          created_at?: string
          current_mileage?: number
          fuel_capacity?: number
          id?: string
          insurance_expiry?: string | null
          license_plate?: string
          name?: string
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_vehicles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_wallet_transactions: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          description: string | null
          id: string
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_wallet_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "laundry_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_wallets: {
        Row: {
          balance: number
          company_id: string
          created_at: string
          customer_id: string
          id: string
          loyalty_points: number
        }
        Insert: {
          balance?: number
          company_id?: string
          created_at?: string
          customer_id: string
          id?: string
          loyalty_points?: number
        }
        Update: {
          balance?: number
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          loyalty_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "laundry_wallets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_wallets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "laundry_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_courses: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_published: boolean | null
          thumbnail_url: string | null
          title: string
          total_modules: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean | null
          thumbnail_url?: string | null
          title: string
          total_modules?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean | null
          thumbnail_url?: string | null
          title?: string
          total_modules?: number | null
        }
        Relationships: []
      }
      learning_modules: {
        Row: {
          company_id: string
          course_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          title: string
          video_url: string | null
        }
        Insert: {
          company_id?: string
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          title: string
          video_url?: string | null
        }
        Update: {
          company_id?: string
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "learning_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_progress: {
        Row: {
          company_id: string
          completed_module_ids: Json | null
          course_id: string | null
          created_at: string
          employee_id: string | null
          id: string
          progress_percentage: number | null
          status: string | null
        }
        Insert: {
          company_id?: string
          completed_module_ids?: Json | null
          course_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          progress_percentage?: number | null
          status?: string | null
        }
        Update: {
          company_id?: string
          completed_module_ids?: Json | null
          course_id?: string | null
          created_at?: string
          employee_id?: string | null
          id?: string
          progress_percentage?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_accrual_rules: {
        Row: {
          accrual_amount: number
          accrual_frequency: string
          carry_forward: boolean | null
          carry_forward_max: number | null
          company_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          leave_type_id: number
          max_balance: number | null
        }
        Insert: {
          accrual_amount?: number
          accrual_frequency?: string
          carry_forward?: boolean | null
          carry_forward_max?: number | null
          company_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          leave_type_id: number
          max_balance?: number | null
        }
        Update: {
          accrual_amount?: number
          accrual_frequency?: string
          carry_forward?: boolean | null
          carry_forward_max?: number | null
          company_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          leave_type_id?: number
          max_balance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_accrual_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_applications: {
        Row: {
          applied_on: string | null
          approved_by: string | null
          company_id: string
          created_at: string | null
          employee_id: string | null
          end_date: string
          id: string
          leave_type_id: number | null
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string | null
        }
        Insert: {
          applied_on?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string | null
          employee_id?: string | null
          end_date: string
          id?: string
          leave_type_id?: number | null
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string | null
        }
        Update: {
          applied_on?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string | null
          employee_id?: string | null
          end_date?: string
          id?: string
          leave_type_id?: number | null
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_applications_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applications_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "org_leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          accrued: number | null
          adjusted: number | null
          closing_balance: number | null
          company_id: string
          created_at: string | null
          employee_id: string
          id: string
          leave_type_id: number
          opening_balance: number | null
          updated_at: string | null
          used: number | null
          year: number
        }
        Insert: {
          accrued?: number | null
          adjusted?: number | null
          closing_balance?: number | null
          company_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          leave_type_id: number
          opening_balance?: number | null
          updated_at?: string | null
          used?: number | null
          year?: number
        }
        Update: {
          accrued?: number | null
          adjusted?: number | null
          closing_balance?: number | null
          company_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          leave_type_id?: number
          opening_balance?: number | null
          updated_at?: string | null
          used?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leaves: {
        Row: {
          airline: string | null
          approved_by: string | null
          attachment_name: string | null
          attachment_url: string | null
          company_id: string
          created_at: string
          employee_id: string | null
          end_date: string
          id: string
          leave_type_id: number | null
          level1_status: string | null
          level2_status: string | null
          manager_comment: string | null
          reason: string | null
          remarks: string | null
          start_date: string
          status: string | null
          ticket_name: string | null
          ticket_number: string | null
          ticket_url: string | null
          type: string
        }
        Insert: {
          airline?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          end_date: string
          id?: string
          leave_type_id?: number | null
          level1_status?: string | null
          level2_status?: string | null
          manager_comment?: string | null
          reason?: string | null
          remarks?: string | null
          start_date: string
          status?: string | null
          ticket_name?: string | null
          ticket_number?: string | null
          ticket_url?: string | null
          type: string
        }
        Update: {
          airline?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          end_date?: string
          id?: string
          leave_type_id?: number | null
          level1_status?: string | null
          level2_status?: string | null
          manager_comment?: string | null
          reason?: string | null
          remarks?: string | null
          start_date?: string
          status?: string | null
          ticket_name?: string | null
          ticket_number?: string | null
          ticket_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "org_leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          company_id: string
          created_at: string
          geofence_radius_meters: number | null
          head_of_location_id: string | null
          id: number
          latitude: number | null
          longitude: number | null
          name: string
          radius_meters: number | null
          status: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string
          created_at?: string
          geofence_radius_meters?: number | null
          head_of_location_id?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name: string
          radius_meters?: number | null
          status?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string
          created_at?: string
          geofence_radius_meters?: number | null
          head_of_location_id?: string | null
          id?: number
          latitude?: number | null
          longitude?: number | null
          name?: string
          radius_meters?: number | null
          status?: string | null
        }
        Relationships: []
      }
      master_kudos_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          icon: string | null
          id: number
          name: string
          points: number | null
          status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          name: string
          points?: number | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: number
          name?: string
          points?: number | null
          status?: string | null
        }
        Relationships: []
      }
      missed_punch_requests: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string
          id: string
          is_active: boolean | null
          punch_type: string
          reason: string
          request_date: string
          requested_time: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          employee_id: string
          id?: string
          is_active?: boolean | null
          punch_type: string
          reason: string
          request_date: string
          requested_time: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_active?: boolean | null
          punch_type?: string
          reason?: string
          request_date?: string
          requested_time?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missed_punch_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_punch_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "missed_punch_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      mrp_bom: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          product_id: string
          quantity: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          product_id: string
          quantity?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          product_id?: string
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_bom_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      mrp_bom_lines: {
        Row: {
          bom_id: string | null
          company_id: string
          created_at: string
          id: string
          item_id: string
          quantity: number
          uom: string | null
        }
        Insert: {
          bom_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          uom?: string | null
        }
        Update: {
          bom_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_bom_lines_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "mrp_bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_bom_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      mrp_production_moves: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string
          move_type: string
          production_order_id: string | null
          quantity_demand: number | null
          quantity_done: number | null
          stock_move_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          item_id: string
          move_type: string
          production_order_id?: string | null
          quantity_demand?: number | null
          quantity_done?: number | null
          stock_move_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          move_type?: string
          production_order_id?: string | null
          quantity_demand?: number | null
          quantity_done?: number | null
          stock_move_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_production_moves_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_production_moves_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "mrp_production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      mrp_production_orders: {
        Row: {
          bom_id: string | null
          company_id: string
          created_at: string
          date_finished: string | null
          date_planned: string | null
          date_start: string | null
          id: string
          name: string
          notes: string | null
          product_id: string
          quantity_produced: number | null
          quantity_to_produce: number
          state: string | null
          warehouse_id: string | null
          work_center_id: string | null
        }
        Insert: {
          bom_id?: string | null
          company_id?: string
          created_at?: string
          date_finished?: string | null
          date_planned?: string | null
          date_start?: string | null
          id?: string
          name: string
          notes?: string | null
          product_id: string
          quantity_produced?: number | null
          quantity_to_produce: number
          state?: string | null
          warehouse_id?: string | null
          work_center_id?: string | null
        }
        Update: {
          bom_id?: string | null
          company_id?: string
          created_at?: string
          date_finished?: string | null
          date_planned?: string | null
          date_start?: string | null
          id?: string
          name?: string
          notes?: string | null
          product_id?: string
          quantity_produced?: number | null
          quantity_to_produce?: number
          state?: string | null
          warehouse_id?: string | null
          work_center_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_production_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "mrp_bom"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_production_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_production_orders_work_center_id_fkey"
            columns: ["work_center_id"]
            isOneToOne: false
            referencedRelation: "mrp_work_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      mrp_routing: {
        Row: {
          code: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          product_id: string | null
        }
        Insert: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          product_id?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_routing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
        ]
      }
      mrp_routing_lines: {
        Row: {
          company_id: string
          created_at: string
          duration_hours: number
          id: string
          notes: string | null
          operation_name: string
          routing_id: string | null
          sequence: number
          work_center_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          duration_hours?: number
          id?: string
          notes?: string | null
          operation_name: string
          routing_id?: string | null
          sequence?: number
          work_center_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          duration_hours?: number
          id?: string
          notes?: string | null
          operation_name?: string
          routing_id?: string | null
          sequence?: number
          work_center_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mrp_routing_lines_routing_id_fkey"
            columns: ["routing_id"]
            isOneToOne: false
            referencedRelation: "mrp_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrp_routing_lines_work_center_id_fkey"
            columns: ["work_center_id"]
            isOneToOne: false
            referencedRelation: "mrp_work_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      mrp_work_centers: {
        Row: {
          capacity_per_day: number | null
          code: string | null
          company_id: string
          cost_per_hour: number | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          capacity_per_day?: number | null
          code?: string | null
          company_id?: string
          cost_per_hour?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          capacity_per_day?: number | null
          code?: string | null
          company_id?: string
          cost_per_hour?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          company_id: string
          email_enabled: boolean | null
          event_type: string
          id: number
          in_app_enabled: boolean | null
          module: string
          notify_roles: string[] | null
        }
        Insert: {
          company_id?: string
          email_enabled?: boolean | null
          event_type: string
          id?: number
          in_app_enabled?: boolean | null
          module: string
          notify_roles?: string[] | null
        }
        Update: {
          company_id?: string
          email_enabled?: boolean | null
          event_type?: string
          id?: number
          in_app_enabled?: boolean | null
          module?: string
          notify_roles?: string[] | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      org_ai_settings: {
        Row: {
          api_key_encrypted: string
          company_id: string
          id: string
          model: string | null
          provider: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted: string
          company_id: string
          id?: string
          model?: string | null
          provider: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string
          company_id?: string
          id?: string
          model?: string | null
          provider?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_ai_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_attendance_settings: {
        Row: {
          company_id: string
          created_at: string
          default_weekly_off_days: string | null
          id: string
          notes: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          default_weekly_off_days?: string | null
          id?: string
          notes?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          default_weekly_off_days?: string | null
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      org_attendance_status: {
        Row: {
          affects_salary: boolean | null
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          affects_salary?: boolean | null
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          affects_salary?: boolean | null
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_bank_configs: {
        Row: {
          bank_name: string
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          bank_name: string
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          bank_name?: string
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_blood_groups: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_confirmation_status: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_crm_stages: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          position: number
          status: string
          updated_at: string | null
          win_probability: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          position?: number
          status?: string
          updated_at?: string | null
          win_probability?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          status?: string
          updated_at?: string | null
          win_probability?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_crm_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_designations: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_employee_statuses: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_employee_statuses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_employment_types: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_exit_reasons: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_faiths: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_financial_years: {
        Row: {
          code: string
          company_id: string
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean | null
          start_date: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          start_date: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_financial_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_grades: {
        Row: {
          code: string
          company_id: string
          created_at: string
          description: string | null
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_holiday_calendar: {
        Row: {
          company_id: string
          created_at: string
          holiday_date: string
          id: number
          is_mandatory: boolean | null
          name: string
          status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          holiday_date: string
          id?: number
          is_mandatory?: boolean | null
          name: string
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          holiday_date?: string
          id?: number
          is_mandatory?: boolean | null
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_holidays: {
        Row: {
          company_id: string
          created_at: string
          date: string
          description: string | null
          id: number
          is_recurring: boolean | null
          name: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          date: string
          description?: string | null
          id?: number
          is_recurring?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: number
          is_recurring?: boolean | null
          name?: string
        }
        Relationships: []
      }
      org_issue_categories: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_issue_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_lead_sources: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_lead_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_leave_calendar_years: {
        Row: {
          company_id: string
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean | null
          start_date: string
          year: number
        }
        Insert: {
          company_id: string
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean | null
          start_date: string
          year: number
        }
        Update: {
          company_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_leave_calendar_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_leave_plans: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_leave_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_leave_policies: {
        Row: {
          can_carry_forward: boolean | null
          code: string
          company_id: string
          created_at: string
          id: number
          leave_type_id: number | null
          max_consecutive_days: number | null
          name: string
          status: string | null
        }
        Insert: {
          can_carry_forward?: boolean | null
          code: string
          company_id?: string
          created_at?: string
          id?: number
          leave_type_id?: number | null
          max_consecutive_days?: number | null
          name: string
          status?: string | null
        }
        Update: {
          can_carry_forward?: boolean | null
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          leave_type_id?: number | null
          max_consecutive_days?: number | null
          name?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_leave_policies_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "org_leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      org_leave_types: {
        Row: {
          code: string
          company_id: string
          created_at: string
          default_balance: number | null
          id: number
          is_paid: boolean | null
          name: string
          requires_approval: boolean | null
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          default_balance?: number | null
          id?: number
          is_paid?: boolean | null
          name: string
          requires_approval?: boolean | null
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          default_balance?: number | null
          id?: number
          is_paid?: boolean | null
          name?: string
          requires_approval?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
      org_marital_status: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_marital_statuses: {
        Row: {
          code: string | null
          company_id: string | null
          id: number
          name: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      org_nationalities: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_pay_groups: {
        Row: {
          attendance_required: boolean | null
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          ot_calculation_basis: string | null
          ot_rate_multiplier: number | null
          ot_working_days_per_month: number | null
          ot_working_hours_per_day: number | null
          pay_frequency: string
          salary_day: number | null
          status: string | null
        }
        Insert: {
          attendance_required?: boolean | null
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          ot_calculation_basis?: string | null
          ot_rate_multiplier?: number | null
          ot_working_days_per_month?: number | null
          ot_working_hours_per_day?: number | null
          pay_frequency: string
          salary_day?: number | null
          status?: string | null
        }
        Update: {
          attendance_required?: boolean | null
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          ot_calculation_basis?: string | null
          ot_rate_multiplier?: number | null
          ot_working_days_per_month?: number | null
          ot_working_hours_per_day?: number | null
          pay_frequency?: string
          salary_day?: number | null
          status?: string | null
        }
        Relationships: []
      }
      org_payroll_months: {
        Row: {
          company_id: string
          created_at: string | null
          financial_year_id: string | null
          id: string
          month_year: string
          status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          financial_year_id?: string | null
          id?: string
          month_year: string
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          financial_year_id?: string | null
          id?: string
          month_year?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_payroll_months_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_payroll_months_financial_year_id_fkey"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "org_financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      org_payroll_settings: {
        Row: {
          calculation_basis: string
          company_id: string
          created_at: string
          esi_employer_contribution: number | null
          id: string
          is_active: boolean | null
          pf_employer_contribution: number | null
          rounding_method: string
          updated_at: string
        }
        Insert: {
          calculation_basis?: string
          company_id: string
          created_at?: string
          esi_employer_contribution?: number | null
          id?: string
          is_active?: boolean | null
          pf_employer_contribution?: number | null
          rounding_method?: string
          updated_at?: string
        }
        Update: {
          calculation_basis?: string
          company_id?: string
          created_at?: string
          esi_employer_contribution?: number | null
          id?: string
          is_active?: boolean | null
          pf_employer_contribution?: number | null
          rounding_method?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_payroll_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_probation_periods: {
        Row: {
          code: string
          company_id: string
          created_at: string
          duration_months: number
          id: number
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          duration_months: number
          id?: number
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          duration_months?: number
          id?: number
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_project_categories: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_project_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_project_types: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_project_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_punch_rules: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          min_work_hours: number | null
          name: string
          overtime_threshold_hours: number | null
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          min_work_hours?: number | null
          name: string
          overtime_threshold_hours?: number | null
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          min_work_hours?: number | null
          name?: string
          overtime_threshold_hours?: number | null
          status?: string | null
        }
        Relationships: []
      }
      org_risk_categories: {
        Row: {
          code: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_risk_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_salary_components: {
        Row: {
          code: string
          company_id: string
          component_type: string
          created_at: string
          id: number
          is_taxable: boolean | null
          name: string
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string
          component_type: string
          created_at?: string
          id?: number
          is_taxable?: boolean | null
          name: string
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          component_type?: string
          created_at?: string
          id?: number
          is_taxable?: boolean | null
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_shift_timings: {
        Row: {
          break_minutes: number | null
          code: string
          company_id: string
          created_at: string
          end_time: string
          full_day_hours: number | null
          grace_period_minutes: number | null
          half_day_hours: number | null
          id: number
          is_overnight: boolean | null
          min_present_hours: number | null
          name: string
          ot_multiplier: number | null
          ot_threshold_hours: number | null
          shift_type: string | null
          start_time: string
          status: string | null
          weekly_off_days: string | null
        }
        Insert: {
          break_minutes?: number | null
          code: string
          company_id?: string
          created_at?: string
          end_time: string
          full_day_hours?: number | null
          grace_period_minutes?: number | null
          half_day_hours?: number | null
          id?: number
          is_overnight?: boolean | null
          min_present_hours?: number | null
          name: string
          ot_multiplier?: number | null
          ot_threshold_hours?: number | null
          shift_type?: string | null
          start_time: string
          status?: string | null
          weekly_off_days?: string | null
        }
        Update: {
          break_minutes?: number | null
          code?: string
          company_id?: string
          created_at?: string
          end_time?: string
          full_day_hours?: number | null
          grace_period_minutes?: number | null
          half_day_hours?: number | null
          id?: number
          is_overnight?: boolean | null
          min_present_hours?: number | null
          name?: string
          ot_multiplier?: number | null
          ot_threshold_hours?: number | null
          shift_type?: string | null
          start_time?: string
          status?: string | null
          weekly_off_days?: string | null
        }
        Relationships: []
      }
      org_skills: {
        Row: {
          category: string | null
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      org_task_priority: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          id: number
          level: number | null
          name: string
          status: string | null
        }
        Insert: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: number
          level?: number | null
          name: string
          status?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: number
          level?: number | null
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_task_status: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          id: number
          is_closed: boolean | null
          name: string
          status: string | null
        }
        Insert: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: number
          is_closed?: boolean | null
          name: string
          status?: string | null
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          id?: number
          is_closed?: boolean | null
          name?: string
          status?: string | null
        }
        Relationships: []
      }
      org_visa_types: {
        Row: {
          code: string | null
          company_id: string | null
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          code?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_visa_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      org_weekoff_rules: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: number
          name: string
          status: string | null
          weekdays: string[] | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: number
          name: string
          status?: string | null
          weekdays?: string[] | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          status?: string | null
          weekdays?: string[] | null
        }
        Relationships: []
      }
      overtime_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_hours: number | null
          company_id: string
          created_at: string | null
          employee_id: string
          id: string
          ot_hours: number
          reason: string | null
          request_date: string
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_hours?: number | null
          company_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          ot_hours?: number
          reason?: string | null
          request_date: string
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_hours?: number | null
          company_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          ot_hours?: number
          reason?: string | null
          request_date?: string
          status?: string | null
        }
        Relationships: []
      }
      payroll: {
        Row: {
          company_id: string
          created_at: string
          deductions: number | null
          employee_id: string | null
          gross_salary: number
          id: string
          month: string
          net_salary: number
          payment_date: string | null
          status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          deductions?: number | null
          employee_id?: string | null
          gross_salary: number
          id?: string
          month: string
          net_salary: number
          payment_date?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deductions?: number | null
          employee_id?: string | null
          gross_salary?: number
          id?: string
          month?: string
          net_salary?: number
          payment_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_attendance_snapshots: {
        Row: {
          absent_days: number | null
          approved_ot_hours: number | null
          attendance_period_id: string
          calendar_days: number | null
          company_id: string
          created_at: string
          created_by: string | null
          early_count: number | null
          early_minutes: number | null
          employee_id: string
          half_days: number | null
          holiday_days: number | null
          id: string
          late_count: number | null
          late_minutes: number | null
          leave_days: number | null
          lop_days: number | null
          missing_punch_count: number | null
          month: number
          month_year: string
          ot_hours: number | null
          paid_leave_days: number | null
          present_days: number | null
          regular_hours: number | null
          status_summary: Json | null
          unpaid_leave_days: number | null
          weekly_off_days: number | null
          worked_hours: number | null
          working_days: number | null
          year: number
        }
        Insert: {
          absent_days?: number | null
          approved_ot_hours?: number | null
          attendance_period_id: string
          calendar_days?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          early_count?: number | null
          early_minutes?: number | null
          employee_id: string
          half_days?: number | null
          holiday_days?: number | null
          id?: string
          late_count?: number | null
          late_minutes?: number | null
          leave_days?: number | null
          lop_days?: number | null
          missing_punch_count?: number | null
          month: number
          month_year: string
          ot_hours?: number | null
          paid_leave_days?: number | null
          present_days?: number | null
          regular_hours?: number | null
          status_summary?: Json | null
          unpaid_leave_days?: number | null
          weekly_off_days?: number | null
          worked_hours?: number | null
          working_days?: number | null
          year: number
        }
        Update: {
          absent_days?: number | null
          approved_ot_hours?: number | null
          attendance_period_id?: string
          calendar_days?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          early_count?: number | null
          early_minutes?: number | null
          employee_id?: string
          half_days?: number | null
          holiday_days?: number | null
          id?: string
          late_count?: number | null
          late_minutes?: number | null
          leave_days?: number | null
          lop_days?: number | null
          missing_punch_count?: number | null
          month?: number
          month_year?: string
          ot_hours?: number | null
          paid_leave_days?: number | null
          present_days?: number | null
          regular_hours?: number | null
          status_summary?: Json | null
          unpaid_leave_days?: number | null
          weekly_off_days?: number | null
          worked_hours?: number | null
          working_days?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_attendance_snapshots_attendance_period_id_fkey"
            columns: ["attendance_period_id"]
            isOneToOne: false
            referencedRelation: "attendance_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_attendance_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_attendance_snapshots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_audit_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          id: string
          metadata: Json | null
          module: string
          month_year: string | null
          new_status: string | null
          period_id: string | null
          previous_status: string | null
          reason: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module: string
          month_year?: string | null
          new_status?: string | null
          period_id?: string | null
          previous_status?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          module?: string
          month_year?: string | null
          new_status?: string | null
          period_id?: string | null
          previous_status?: string | null
          reason?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_loans: {
        Row: {
          amount: number
          balance: number
          company_id: string
          created_at: string | null
          emi_amount: number
          employee_id: string
          id: string
          loan_type: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          balance: number
          company_id: string
          created_at?: string | null
          emi_amount: number
          employee_id: string
          id?: string
          loan_type: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          balance?: number
          company_id?: string
          created_at?: string | null
          emi_amount?: number
          employee_id?: string
          id?: string
          loan_type?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_loans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          approved_ot_hours: number | null
          attendance_snapshot_id: string | null
          basic_salary: number | null
          company_id: string
          created_at: string | null
          early_count: number | null
          early_deduction: number | null
          employee_id: string | null
          exceptions: Json | null
          fixed_allowance: number | null
          gross_earning: number | null
          gross_salary: number | null
          has_exception: boolean | null
          id: string
          late_count: number | null
          late_deduction: number | null
          loan_deduction: number | null
          lop_amount: number | null
          lop_days: number | null
          month_year: string
          net_pay: number | null
          ot_amount: number | null
          ot_hours: number | null
          payable_days: number | null
          payment_date: string | null
          payroll_run_id: string | null
          present_days: number | null
          salary_breakdown: Json | null
          status: string | null
          total_deduction: number | null
          variable_allowance: number | null
          variable_deduction: number | null
          working_days: number | null
        }
        Insert: {
          approved_ot_hours?: number | null
          attendance_snapshot_id?: string | null
          basic_salary?: number | null
          company_id: string
          created_at?: string | null
          early_count?: number | null
          early_deduction?: number | null
          employee_id?: string | null
          exceptions?: Json | null
          fixed_allowance?: number | null
          gross_earning?: number | null
          gross_salary?: number | null
          has_exception?: boolean | null
          id?: string
          late_count?: number | null
          late_deduction?: number | null
          loan_deduction?: number | null
          lop_amount?: number | null
          lop_days?: number | null
          month_year: string
          net_pay?: number | null
          ot_amount?: number | null
          ot_hours?: number | null
          payable_days?: number | null
          payment_date?: string | null
          payroll_run_id?: string | null
          present_days?: number | null
          salary_breakdown?: Json | null
          status?: string | null
          total_deduction?: number | null
          variable_allowance?: number | null
          variable_deduction?: number | null
          working_days?: number | null
        }
        Update: {
          approved_ot_hours?: number | null
          attendance_snapshot_id?: string | null
          basic_salary?: number | null
          company_id?: string
          created_at?: string | null
          early_count?: number | null
          early_deduction?: number | null
          employee_id?: string | null
          exceptions?: Json | null
          fixed_allowance?: number | null
          gross_earning?: number | null
          gross_salary?: number | null
          has_exception?: boolean | null
          id?: string
          late_count?: number | null
          late_deduction?: number | null
          loan_deduction?: number | null
          lop_amount?: number | null
          lop_days?: number | null
          month_year?: string
          net_pay?: number | null
          ot_amount?: number | null
          ot_hours?: number | null
          payable_days?: number | null
          payment_date?: string | null
          payroll_run_id?: string | null
          present_days?: number | null
          salary_breakdown?: Json | null
          status?: string | null
          total_deduction?: number | null
          variable_allowance?: number | null
          variable_deduction?: number | null
          working_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_attendance_snapshot_id_fkey"
            columns: ["attendance_snapshot_id"]
            isOneToOne: false
            referencedRelation: "payroll_attendance_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          attendance_period_id: string | null
          company_id: string
          created_at: string
          finalized_at: string | null
          finalized_by: string | null
          id: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          month_year: string | null
          name: string | null
          period_end: string | null
          period_start: string | null
          preprocessed_at: string | null
          preprocessed_by: string | null
          status: string | null
          total_amount: number | null
          total_basic: number | null
          total_fixed_allowances: number | null
          total_gross: number | null
          total_loan_deductions: number | null
          total_lop_deductions: number | null
          total_net_pay: number | null
          total_ot_amount: number | null
          total_variable_allowances: number | null
          total_variable_deductions: number | null
        }
        Insert: {
          attendance_period_id?: string | null
          company_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          month_year?: string | null
          name?: string | null
          period_end?: string | null
          period_start?: string | null
          preprocessed_at?: string | null
          preprocessed_by?: string | null
          status?: string | null
          total_amount?: number | null
          total_basic?: number | null
          total_fixed_allowances?: number | null
          total_gross?: number | null
          total_loan_deductions?: number | null
          total_lop_deductions?: number | null
          total_net_pay?: number | null
          total_ot_amount?: number | null
          total_variable_allowances?: number | null
          total_variable_deductions?: number | null
        }
        Update: {
          attendance_period_id?: string | null
          company_id?: string
          created_at?: string
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          month_year?: string | null
          name?: string | null
          period_end?: string | null
          period_start?: string | null
          preprocessed_at?: string | null
          preprocessed_by?: string | null
          status?: string | null
          total_amount?: number | null
          total_basic?: number | null
          total_fixed_allowances?: number | null
          total_gross?: number | null
          total_loan_deductions?: number | null
          total_lop_deductions?: number | null
          total_net_pay?: number | null
          total_ot_amount?: number | null
          total_variable_allowances?: number | null
          total_variable_deductions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_attendance_period_id_fkey"
            columns: ["attendance_period_id"]
            isOneToOne: false
            referencedRelation: "attendance_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_variable_inputs: {
        Row: {
          amount: number
          company_id: string
          component_code: string
          component_id: number | null
          component_name: string
          created_at: string
          created_by: string | null
          effective_date: string | null
          employee_code: string | null
          employee_id: string
          employee_name: string | null
          id: string
          input_type: string
          is_locked: boolean | null
          month_year: string
          payroll_run_id: string | null
          reference: string | null
          remarks: string | null
          status: string | null
          validation_notes: string | null
        }
        Insert: {
          amount: number
          company_id: string
          component_code: string
          component_id?: number | null
          component_name: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          employee_code?: string | null
          employee_id: string
          employee_name?: string | null
          id?: string
          input_type: string
          is_locked?: boolean | null
          month_year: string
          payroll_run_id?: string | null
          reference?: string | null
          remarks?: string | null
          status?: string | null
          validation_notes?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          component_code?: string
          component_id?: number | null
          component_name?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          employee_code?: string | null
          employee_id?: string
          employee_name?: string | null
          id?: string
          input_type?: string
          is_locked?: boolean | null
          month_year?: string
          payroll_run_id?: string | null
          reference?: string | null
          remarks?: string | null
          status?: string | null
          validation_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_variable_inputs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_variable_inputs_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "org_salary_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_variable_inputs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_variable_inputs_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          basic_salary: number | null
          company_id: string
          created_at: string
          employee_id: string | null
          gross_salary: number | null
          id: string
          net_salary: number | null
          payroll_run_id: string | null
          status: string | null
        }
        Insert: {
          basic_salary?: number | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          gross_salary?: number | null
          id?: string
          net_salary?: number | null
          payroll_run_id?: string | null
          status?: string | null
        }
        Update: {
          basic_salary?: number | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          gross_salary?: number | null
          id?: string
          net_salary?: number | null
          payroll_run_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_projects: {
        Row: {
          actual_end_date: string | null
          actual_start_date: string | null
          budget: number | null
          client_id: string | null
          commercial_proposal_id: string | null
          company_id: string
          completion_pct: number | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: number | null
          description: string | null
          end_date: string | null
          id: string
          is_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          lpo_cost: number | null
          lpo_document_url: string | null
          lpo_number: string | null
          name: string
          project_category_id: string | null
          project_manager_id: string | null
          project_type_id: string | null
          remarks: string | null
          start_date: string | null
          status: string
          technical_proposal_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          budget?: number | null
          client_id?: string | null
          commercial_proposal_id?: string | null
          company_id: string
          completion_pct?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          lpo_cost?: number | null
          lpo_document_url?: string | null
          lpo_number?: string | null
          name: string
          project_category_id?: string | null
          project_manager_id?: string | null
          project_type_id?: string | null
          remarks?: string | null
          start_date?: string | null
          status?: string
          technical_proposal_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          actual_end_date?: string | null
          actual_start_date?: string | null
          budget?: number | null
          client_id?: string | null
          commercial_proposal_id?: string | null
          company_id?: string
          completion_pct?: number | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: number | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          lpo_cost?: number | null
          lpo_document_url?: string | null
          lpo_number?: string | null
          name?: string
          project_category_id?: string | null
          project_manager_id?: string | null
          project_type_id?: string | null
          remarks?: string | null
          start_date?: string | null
          status?: string
          technical_proposal_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pm_projects_comm_prop"
            columns: ["commercial_proposal_id"]
            isOneToOne: false
            referencedRelation: "project_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pm_projects_tech_prop"
            columns: ["technical_proposal_id"]
            isOneToOne: false
            referencedRelation: "project_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "accounting_cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_project_category_id_fkey"
            columns: ["project_category_id"]
            isOneToOne: false
            referencedRelation: "org_project_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_project_manager_id_fkey"
            columns: ["project_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_projects_project_type_id_fkey"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "org_project_types"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_tasks: {
        Row: {
          assignee_id: string | null
          company_id: string
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          progress_pct: number | null
          project_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          company_id: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          progress_pct?: number | null
          project_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          company_id?: string
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          progress_pct?: number | null
          project_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pm_tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_timesheets: {
        Row: {
          company_id: string
          created_at: string | null
          date: string
          description: string | null
          employee_id: string
          hours: number
          id: string
          task_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          date?: string
          description?: string | null
          employee_id: string
          hours: number
          id?: string
          task_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          date?: string
          description?: string | null
          employee_id?: string
          hours?: number
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_timesheets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_timesheets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "pm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          created_at: string | null
          id: string
          option_text: string
          poll_id: string | null
          vote_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          option_text: string
          poll_id?: string | null
          vote_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          option_text?: string
          poll_id?: string | null
          vote_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          option_id: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          option_id: string
          poll_id: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          option_id?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          question: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          question: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      print_templates: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pro_activity_log: {
        Row: {
          action_type: string
          application_id: string | null
          attachment_name: string | null
          attachment_url: string | null
          comment: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          created_by_role: string | null
          id: string
          new_status: string | null
          old_status: string | null
        }
        Insert: {
          action_type?: string
          application_id?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          comment?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Update: {
          action_type?: string
          application_id?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          comment?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_by_role?: string | null
          id?: string
          new_status?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_activity_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "pro_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_applications: {
        Row: {
          applicant_employee_id: string | null
          application_number: string | null
          application_type: string
          assigned_pro_id: string | null
          attachment_name: string | null
          attachment_url: string | null
          company_id: string
          cost: number | null
          created_at: string | null
          created_by: string | null
          dependent_name: string | null
          expiry_date: string | null
          government_fees: number | null
          id: string
          passport_number: string | null
          qid_number: string | null
          receipt_url: string | null
          remarks: string | null
          requested_by_id: string | null
          requested_by_role: string | null
          service_category: string | null
          sponsor_entity: string | null
          stage: string | null
          status: string | null
          submission_date: string | null
          title: string
          updated_at: string | null
          urgent_flag: boolean | null
          workflow_instance_id: string | null
        }
        Insert: {
          applicant_employee_id?: string | null
          application_number?: string | null
          application_type: string
          assigned_pro_id?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          dependent_name?: string | null
          expiry_date?: string | null
          government_fees?: number | null
          id?: string
          passport_number?: string | null
          qid_number?: string | null
          receipt_url?: string | null
          remarks?: string | null
          requested_by_id?: string | null
          requested_by_role?: string | null
          service_category?: string | null
          sponsor_entity?: string | null
          stage?: string | null
          status?: string | null
          submission_date?: string | null
          title: string
          updated_at?: string | null
          urgent_flag?: boolean | null
          workflow_instance_id?: string | null
        }
        Update: {
          applicant_employee_id?: string | null
          application_number?: string | null
          application_type?: string
          assigned_pro_id?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          dependent_name?: string | null
          expiry_date?: string | null
          government_fees?: number | null
          id?: string
          passport_number?: string | null
          qid_number?: string | null
          receipt_url?: string | null
          remarks?: string | null
          requested_by_id?: string | null
          requested_by_role?: string | null
          service_category?: string | null
          sponsor_entity?: string | null
          stage?: string | null
          status?: string | null
          submission_date?: string | null
          title?: string
          updated_at?: string | null
          urgent_flag?: boolean | null
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_applications_applicant_employee_id_fkey"
            columns: ["applicant_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_documents: {
        Row: {
          attachment_url: string | null
          company_id: string
          created_at: string | null
          document_name: string
          document_number: string | null
          document_type: string
          entity_id: string | null
          entity_type: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attachment_url?: string | null
          company_id?: string
          created_at?: string | null
          document_name: string
          document_number?: string | null
          document_type: string
          entity_id?: string | null
          entity_type?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attachment_url?: string | null
          company_id?: string
          created_at?: string | null
          document_name?: string
          document_number?: string | null
          document_type?: string
          entity_id?: string | null
          entity_type?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pro_licenses: {
        Row: {
          alert_days: number | null
          company_id: string
          created_at: string | null
          document_url: string | null
          expiry_date: string | null
          fee_amount: number | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          license_name: string
          license_number: string
          renewal_status: string | null
          responsible_employee_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          alert_days?: number | null
          company_id?: string
          created_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          fee_amount?: number | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          license_name: string
          license_number: string
          renewal_status?: string | null
          responsible_employee_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_days?: number | null
          company_id?: string
          created_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          fee_amount?: number | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          license_name?: string
          license_number?: string
          renewal_status?: string | null
          responsible_employee_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pro_renewals: {
        Row: {
          assigned_to: string | null
          company_id: string
          cost: number | null
          created_at: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          renewal_due_date: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string
          cost?: number | null
          created_at?: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          id?: string
          renewal_due_date: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          cost?: number | null
          created_at?: string | null
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          renewal_due_date?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_renewals_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_tasks: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          fee_paid: number | null
          govt_office: string | null
          id: string
          location_address: string | null
          priority: string | null
          receipt_url: string | null
          related_application_id: string | null
          result_notes: string | null
          scheduled_date: string | null
          status: string | null
          task_name: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          fee_paid?: number | null
          govt_office?: string | null
          id?: string
          location_address?: string | null
          priority?: string | null
          receipt_url?: string | null
          related_application_id?: string | null
          result_notes?: string | null
          scheduled_date?: string | null
          status?: string | null
          task_name: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          fee_paid?: number | null
          govt_office?: string | null
          id?: string
          location_address?: string | null
          priority?: string | null
          receipt_url?: string | null
          related_application_id?: string | null
          result_notes?: string | null
          scheduled_date?: string | null
          status?: string | null
          task_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pro_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pro_tasks_related_application_id_fkey"
            columns: ["related_application_id"]
            isOneToOne: false
            referencedRelation: "pro_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          employee_id: string | null
          full_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          employee_id?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_audit_log: {
        Row: {
          action: string
          actor_id: string
          company_id: string
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          new_status: string | null
          previous_status: string | null
          project_id: string | null
          remarks: string | null
        }
        Insert: {
          action: string
          actor_id: string
          company_id: string
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          project_id?: string | null
          remarks?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          company_id?: string
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          project_id?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_completion_requests: {
        Row: {
          actual_completion_date: string
          company_id: string
          completion_report_url: string | null
          completion_summary: string
          created_at: string | null
          final_completion_pct: number
          final_remarks: string | null
          handover_document_url: string | null
          id: string
          outstanding_work: string | null
          project_id: string
          return_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string
          testing_records_url: string | null
        }
        Insert: {
          actual_completion_date: string
          company_id: string
          completion_report_url?: string | null
          completion_summary: string
          created_at?: string | null
          final_completion_pct?: number
          final_remarks?: string | null
          handover_document_url?: string | null
          id?: string
          outstanding_work?: string | null
          project_id: string
          return_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by: string
          testing_records_url?: string | null
        }
        Update: {
          actual_completion_date?: string
          company_id?: string
          completion_report_url?: string | null
          completion_summary?: string
          created_at?: string | null
          final_completion_pct?: number
          final_remarks?: string | null
          handover_document_url?: string | null
          id?: string
          outstanding_work?: string | null
          project_id?: string
          return_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string
          testing_records_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_completion_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_completion_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_daily_activities: {
        Row: {
          activity_date: string
          activity_description: string | null
          company_id: string
          completed_quantity: number | null
          completed_work: string | null
          created_at: string | null
          created_by: string
          delay_reason: string | null
          id: string
          issues: string | null
          planned_quantity: number | null
          planned_work: string | null
          progress_pct: number | null
          project_id: string
          remarks: string | null
          return_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk: string | null
          safety_observation: string | null
          status: string | null
          supervisor_id: string
          updated_at: string | null
          updated_by: string | null
          work_area: string | null
          worker_count: number | null
        }
        Insert: {
          activity_date: string
          activity_description?: string | null
          company_id: string
          completed_quantity?: number | null
          completed_work?: string | null
          created_at?: string | null
          created_by: string
          delay_reason?: string | null
          id?: string
          issues?: string | null
          planned_quantity?: number | null
          planned_work?: string | null
          progress_pct?: number | null
          project_id: string
          remarks?: string | null
          return_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk?: string | null
          safety_observation?: string | null
          status?: string | null
          supervisor_id: string
          updated_at?: string | null
          updated_by?: string | null
          work_area?: string | null
          worker_count?: number | null
        }
        Update: {
          activity_date?: string
          activity_description?: string | null
          company_id?: string
          completed_quantity?: number | null
          completed_work?: string | null
          created_at?: string | null
          created_by?: string
          delay_reason?: string | null
          id?: string
          issues?: string | null
          planned_quantity?: number | null
          planned_work?: string | null
          progress_pct?: number | null
          project_id?: string
          remarks?: string | null
          return_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk?: string | null
          safety_observation?: string | null
          status?: string | null
          supervisor_id?: string
          updated_at?: string | null
          updated_by?: string | null
          work_area?: string | null
          worker_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_activities_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_daily_activity_documents: {
        Row: {
          activity_id: string
          company_id: string
          created_at: string | null
          file_name: string | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          activity_id: string
          company_id: string
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          activity_id?: string
          company_id?: string
          created_at?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_daily_activity_documents_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "project_daily_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_daily_activity_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_issues: {
        Row: {
          action_required: string | null
          assigned_to: string | null
          category: string | null
          company_id: string
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          impact: string | null
          issue_date: string | null
          project_id: string
          resolution: string | null
          severity: string | null
          status: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          action_required?: string | null
          assigned_to?: string | null
          category?: string | null
          company_id: string
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          issue_date?: string | null
          project_id: string
          resolution?: string | null
          severity?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          action_required?: string | null
          assigned_to?: string | null
          category?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          impact?: string | null
          issue_date?: string | null
          project_id?: string
          resolution?: string | null
          severity?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_issues_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_issues_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_proposal_audit: {
        Row: {
          action: string
          actor_id: string
          company_id: string
          created_at: string | null
          id: string
          new_status: string | null
          previous_status: string | null
          proposal_id: string
          remarks: string | null
          revision_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          company_id: string
          created_at?: string | null
          id?: string
          new_status?: string | null
          previous_status?: string | null
          proposal_id: string
          remarks?: string | null
          revision_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          company_id?: string
          created_at?: string | null
          id?: string
          new_status?: string | null
          previous_status?: string | null
          proposal_id?: string
          remarks?: string | null
          revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_proposal_audit_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposal_audit_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "project_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposal_audit_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "project_proposal_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_proposal_revisions: {
        Row: {
          company_id: string
          costing_sheet_file_url: string | null
          created_at: string | null
          id: string
          proposal_id: string
          quotation_file_url: string | null
          rejection_reason: string | null
          remarks: string | null
          return_reason: string | null
          reviewer_id: string | null
          revision_number: number
          status: string
          submitted_at: string | null
          submitted_by: string
          technical_file_url: string | null
        }
        Insert: {
          company_id: string
          costing_sheet_file_url?: string | null
          created_at?: string | null
          id?: string
          proposal_id: string
          quotation_file_url?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          return_reason?: string | null
          reviewer_id?: string | null
          revision_number: number
          status?: string
          submitted_at?: string | null
          submitted_by: string
          technical_file_url?: string | null
        }
        Update: {
          company_id?: string
          costing_sheet_file_url?: string | null
          created_at?: string | null
          id?: string
          proposal_id?: string
          quotation_file_url?: string | null
          rejection_reason?: string | null
          remarks?: string | null
          return_reason?: string | null
          reviewer_id?: string | null
          revision_number?: number
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          technical_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_proposal_revisions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposal_revisions_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "project_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposal_revisions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_proposals: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string | null
          created_by: string
          currency: string | null
          current_revision: number
          deal_id: number | null
          first_reviewer_id: string | null
          id: string
          is_locked: boolean | null
          locked_at: string | null
          locked_by: string | null
          proposal_type: string
          quotation_reference: string | null
          remarks: string | null
          rfq_reference: string | null
          status: string
          submission_deadline: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string | null
          created_by: string
          currency?: string | null
          current_revision?: number
          deal_id?: number | null
          first_reviewer_id?: string | null
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          proposal_type: string
          quotation_reference?: string | null
          remarks?: string | null
          rfq_reference?: string | null
          status?: string
          submission_deadline?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string | null
          created_by?: string
          currency?: string | null
          current_revision?: number
          deal_id?: number | null
          first_reviewer_id?: string | null
          id?: string
          is_locked?: boolean | null
          locked_at?: string | null
          locked_by?: string | null
          proposal_type?: string
          quotation_reference?: string | null
          remarks?: string | null
          rfq_reference?: string | null
          status?: string
          submission_deadline?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_proposals_first_reviewer_id_fkey"
            columns: ["first_reviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_required_documents: {
        Row: {
          company_id: string
          confirmed: boolean | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          project_id: string
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          company_id: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          document_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          project_id: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          company_id?: string
          confirmed?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          project_id?: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_required_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_required_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_risks: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          id: string
          impact: string | null
          mitigation: string | null
          owner_id: string | null
          probability: string | null
          project_id: string
          risk_score: string | null
          status: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          id?: string
          impact?: string | null
          mitigation?: string | null
          owner_id?: string | null
          probability?: string | null
          project_id: string
          risk_score?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          impact?: string | null
          mitigation?: string | null
          owner_id?: string | null
          probability?: string | null
          project_id?: string
          risk_score?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_risks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_risks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_safety_observations: {
        Row: {
          activity_id: string | null
          closed_at: string | null
          closure_status: string | null
          company_id: string
          corrective_action: string | null
          created_at: string | null
          created_by: string
          description: string
          due_date: string | null
          id: string
          observation_type: string | null
          project_id: string
          responsible_person_id: string | null
          updated_at: string | null
        }
        Insert: {
          activity_id?: string | null
          closed_at?: string | null
          closure_status?: string | null
          company_id: string
          corrective_action?: string | null
          created_at?: string | null
          created_by: string
          description: string
          due_date?: string | null
          id?: string
          observation_type?: string | null
          project_id: string
          responsible_person_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_id?: string | null
          closed_at?: string | null
          closure_status?: string | null
          company_id?: string
          corrective_action?: string | null
          created_at?: string | null
          created_by?: string
          description?: string
          due_date?: string | null
          id?: string
          observation_type?: string | null
          project_id?: string
          responsible_person_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_safety_observations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "project_daily_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_safety_observations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_safety_observations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_safety_observations_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      project_supervisors: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          company_id: string
          employee_id: string
          end_date: string | null
          id: string
          is_active: boolean | null
          project_id: string
          responsibilities: string | null
          start_date: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id: string
          employee_id: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          project_id: string
          responsibilities?: string | null
          start_date?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          company_id?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          project_id?: string
          responsibilities?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_supervisors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supervisors_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supervisors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pm_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string
          order_id: string | null
          quantity: number
          quantity_received: number | null
          subtotal: number | null
          unit_price: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          item_id: string
          order_id?: string | null
          quantity: number
          quantity_received?: number | null
          subtotal?: number | null
          unit_price?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          order_id?: string | null
          quantity?: number
          quantity_received?: number | null
          subtotal?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          expected_date: string | null
          id: string
          name: string
          notes: string | null
          order_date: string | null
          partner_id: string
          state: string | null
          total_amount: number | null
          warehouse_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          expected_date?: string | null
          id?: string
          name: string
          notes?: string | null
          order_date?: string | null
          partner_id: string
          state?: string | null
          total_amount?: number | null
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          expected_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_date?: string | null
          partner_id?: string
          state?: string | null
          total_amount?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      putaway_rules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          priority: number | null
          storage_category_id: string | null
          target_zone_id: string
          warehouse_id: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          storage_category_id?: string | null
          target_zone_id: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          storage_category_id?: string | null
          target_zone_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "putaway_rules_storage_category_id_fkey"
            columns: ["storage_category_id"]
            isOneToOne: false
            referencedRelation: "storage_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_rules_target_zone_id_fkey"
            columns: ["target_zone_id"]
            isOneToOne: false
            referencedRelation: "warehouse_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_rules_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_applicants: {
        Row: {
          company_id: string
          cover_letter: string | null
          created_at: string
          email: string
          id: string
          interview_date: string | null
          interviewer_notes: string | null
          job_id: string
          name: string
          phone: string | null
          rating: number | null
          resume_url: string
          stage: string
          updated_at: string
        }
        Insert: {
          company_id: string
          cover_letter?: string | null
          created_at?: string
          email: string
          id?: string
          interview_date?: string | null
          interviewer_notes?: string | null
          job_id: string
          name: string
          phone?: string | null
          rating?: number | null
          resume_url: string
          stage?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          cover_letter?: string | null
          created_at?: string
          email?: string
          id?: string
          interview_date?: string | null
          interviewer_notes?: string | null
          job_id?: string
          name?: string
          phone?: string | null
          rating?: number | null
          resume_url?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_applicants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_applicants_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruitment_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_applications: {
        Row: {
          applied_at: string
          candidate_id: string
          company_id: string
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          match_details: Json | null
          match_score: number | null
          rejection_reason: string | null
          requisition_id: string | null
          source_name: string | null
          stage: string
          stage_entered_at: string
          status: string
          updated_at: string
        }
        Insert: {
          applied_at?: string
          candidate_id: string
          company_id: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          match_details?: Json | null
          match_score?: number | null
          rejection_reason?: string | null
          requisition_id?: string | null
          source_name?: string | null
          stage?: string
          stage_entered_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          applied_at?: string
          candidate_id?: string
          company_id?: string
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          match_details?: Json | null
          match_score?: number | null
          rejection_reason?: string | null
          requisition_id?: string | null
          source_name?: string | null
          stage?: string
          stage_entered_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_applications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruitment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_applications_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "recruitment_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidate_documents: {
        Row: {
          candidate_id: string
          company_id: string
          content_hash: string | null
          created_at: string
          document_category: string
          extracted_text: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          is_current: boolean
          parser_confidence: string | null
          parser_data: Json | null
          parser_status: string | null
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          candidate_id: string
          company_id: string
          content_hash?: string | null
          created_at?: string
          document_category?: string
          extracted_text?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean
          parser_confidence?: string | null
          parser_data?: Json | null
          parser_status?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Update: {
          candidate_id?: string
          company_id?: string
          content_hash?: string | null
          created_at?: string
          document_category?: string
          extracted_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean
          parser_confidence?: string | null
          parser_data?: Json | null
          parser_status?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidate_documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidate_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidate_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidate_notes: {
        Row: {
          author_id: string | null
          candidate_id: string
          company_id: string
          content: string
          created_at: string
          id: string
          note_type: string | null
        }
        Insert: {
          author_id?: string | null
          candidate_id: string
          company_id: string
          content: string
          created_at?: string
          id?: string
          note_type?: string | null
        }
        Update: {
          author_id?: string | null
          candidate_id?: string
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidate_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidate_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidate_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidate_skills: {
        Row: {
          candidate_id: string
          company_id: string
          created_at: string
          id: string
          proficiency: string | null
          skill_name: string
          source: string | null
          years_of_experience: number | null
        }
        Insert: {
          candidate_id: string
          company_id: string
          created_at?: string
          id?: string
          proficiency?: string | null
          skill_name: string
          source?: string | null
          years_of_experience?: number | null
        }
        Update: {
          candidate_id?: string
          company_id?: string
          created_at?: string
          id?: string
          proficiency?: string | null
          skill_name?: string
          source?: string | null
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidate_skills_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidate_skills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_candidates: {
        Row: {
          candidate_code: string | null
          company_id: string
          created_at: string
          currency: string | null
          current_company: string | null
          current_location: string | null
          current_salary: number | null
          current_title: string | null
          education_degree: string | null
          education_institution: string | null
          email: string
          employee_id: string | null
          expected_salary: number | null
          first_name: string
          highest_education: string | null
          id: string
          last_name: string | null
          linkedin_url: string | null
          notes: string | null
          notice_period_days: number | null
          phone: string | null
          photo_url: string | null
          pool_category: string | null
          portfolio_url: string | null
          rating: number | null
          relevant_experience_years: number | null
          source_name: string | null
          status: string
          tags: string[] | null
          total_experience_years: number | null
          updated_at: string
        }
        Insert: {
          candidate_code?: string | null
          company_id: string
          created_at?: string
          currency?: string | null
          current_company?: string | null
          current_location?: string | null
          current_salary?: number | null
          current_title?: string | null
          education_degree?: string | null
          education_institution?: string | null
          email: string
          employee_id?: string | null
          expected_salary?: number | null
          first_name: string
          highest_education?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          notice_period_days?: number | null
          phone?: string | null
          photo_url?: string | null
          pool_category?: string | null
          portfolio_url?: string | null
          rating?: number | null
          relevant_experience_years?: number | null
          source_name?: string | null
          status?: string
          tags?: string[] | null
          total_experience_years?: number | null
          updated_at?: string
        }
        Update: {
          candidate_code?: string | null
          company_id?: string
          created_at?: string
          currency?: string | null
          current_company?: string | null
          current_location?: string | null
          current_salary?: number | null
          current_title?: string | null
          education_degree?: string | null
          education_institution?: string | null
          email?: string
          employee_id?: string | null
          expected_salary?: number | null
          first_name?: string
          highest_education?: string | null
          id?: string
          last_name?: string | null
          linkedin_url?: string | null
          notes?: string | null
          notice_period_days?: number | null
          phone?: string | null
          photo_url?: string | null
          pool_category?: string | null
          portfolio_url?: string | null
          rating?: number | null
          relevant_experience_years?: number | null
          source_name?: string | null
          status?: string
          tags?: string[] | null
          total_experience_years?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_candidates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_candidates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_interview_evaluations: {
        Row: {
          comments: string | null
          company_id: string
          created_at: string
          criteria_scores: Json
          id: string
          interview_id: string
          interviewer_id: string | null
          overall_rating: number | null
          recommendation: string
        }
        Insert: {
          comments?: string | null
          company_id: string
          created_at?: string
          criteria_scores?: Json
          id?: string
          interview_id: string
          interviewer_id?: string | null
          overall_rating?: number | null
          recommendation?: string
        }
        Update: {
          comments?: string | null
          company_id?: string
          created_at?: string
          criteria_scores?: Json
          id?: string
          interview_id?: string
          interviewer_id?: string | null
          overall_rating?: number | null
          recommendation?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interview_evaluations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interview_evaluations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "recruitment_interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interview_evaluations_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_interviews: {
        Row: {
          application_id: string
          company_id: string
          created_at: string
          end_time: string
          id: string
          interview_type: string
          interviewer_ids: string[] | null
          location: string | null
          meeting_link: string | null
          notes: string | null
          round_name: string
          round_number: number
          scheduled_date: string
          scorecard_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          application_id: string
          company_id: string
          created_at?: string
          end_time: string
          id?: string
          interview_type?: string
          interviewer_ids?: string[] | null
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          round_name?: string
          round_number?: number
          scheduled_date: string
          scorecard_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          company_id?: string
          created_at?: string
          end_time?: string
          id?: string
          interview_type?: string
          interviewer_ids?: string[] | null
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          round_name?: string
          round_number?: number
          scheduled_date?: string
          scorecard_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interviews_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_interviews_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "recruitment_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_jobs: {
        Row: {
          application_deadline: string | null
          company_id: string
          created_at: string
          currency: string | null
          department_id: number | null
          description: string
          education_level: string | null
          employment_type: string
          hiring_manager_id: string | null
          id: string
          location: string
          max_experience_years: number | null
          min_experience_years: number | null
          preferred_skills: string[] | null
          priority: string | null
          recruiter_id: string | null
          required_skills: string[] | null
          requirements: string | null
          requisition_id: string | null
          responsibilities: string | null
          salary_range_max: number | null
          salary_range_min: number | null
          status: string
          title: string
          updated_at: string
          vacancies: number | null
          views: number | null
        }
        Insert: {
          application_deadline?: string | null
          company_id: string
          created_at?: string
          currency?: string | null
          department_id?: number | null
          description: string
          education_level?: string | null
          employment_type: string
          hiring_manager_id?: string | null
          id?: string
          location: string
          max_experience_years?: number | null
          min_experience_years?: number | null
          preferred_skills?: string[] | null
          priority?: string | null
          recruiter_id?: string | null
          required_skills?: string[] | null
          requirements?: string | null
          requisition_id?: string | null
          responsibilities?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          status?: string
          title: string
          updated_at?: string
          vacancies?: number | null
          views?: number | null
        }
        Update: {
          application_deadline?: string | null
          company_id?: string
          created_at?: string
          currency?: string | null
          department_id?: number | null
          description?: string
          education_level?: string | null
          employment_type?: string
          hiring_manager_id?: string | null
          id?: string
          location?: string
          max_experience_years?: number | null
          min_experience_years?: number | null
          preferred_skills?: string[] | null
          priority?: string | null
          recruiter_id?: string | null
          required_skills?: string[] | null
          requirements?: string | null
          requisition_id?: string | null
          responsibilities?: string | null
          salary_range_max?: number | null
          salary_range_min?: number | null
          status?: string
          title?: string
          updated_at?: string
          vacancies?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_jobs_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_jobs_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_offers: {
        Row: {
          allowances: Json | null
          application_id: string
          basic_salary: number
          candidate_id: string
          company_id: string
          created_at: string
          currency: string
          department_id: number | null
          designation_id: number | null
          id: string
          job_id: string
          joining_date: string
          notice_period_days: number | null
          offer_expiry_date: string | null
          offer_number: string
          probation_months: number | null
          remarks: string | null
          status: string
          total_salary: number
          updated_at: string
          workflow_instance_id: string | null
        }
        Insert: {
          allowances?: Json | null
          application_id: string
          basic_salary?: number
          candidate_id: string
          company_id: string
          created_at?: string
          currency?: string
          department_id?: number | null
          designation_id?: number | null
          id?: string
          job_id: string
          joining_date: string
          notice_period_days?: number | null
          offer_expiry_date?: string | null
          offer_number: string
          probation_months?: number | null
          remarks?: string | null
          status?: string
          total_salary?: number
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Update: {
          allowances?: Json | null
          application_id?: string
          basic_salary?: number
          candidate_id?: string
          company_id?: string
          created_at?: string
          currency?: string
          department_id?: number | null
          designation_id?: number | null
          id?: string
          job_id?: string
          joining_date?: string
          notice_period_days?: number | null
          offer_expiry_date?: string | null
          offer_number?: string
          probation_months?: number | null
          remarks?: string | null
          status?: string
          total_salary?: number
          updated_at?: string
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_offers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_offers_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_offers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_offers_designation_id_fkey"
            columns: ["designation_id"]
            isOneToOne: false
            referencedRelation: "org_designations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_offers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruitment_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_referrals: {
        Row: {
          bonus_amount: number | null
          bonus_paid: boolean | null
          candidate_id: string
          company_id: string
          created_at: string
          id: string
          job_id: string | null
          notes: string | null
          referral_date: string | null
          referrer_id: string | null
          status: string
        }
        Insert: {
          bonus_amount?: number | null
          bonus_paid?: boolean | null
          candidate_id: string
          company_id: string
          created_at?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          referral_date?: string | null
          referrer_id?: string | null
          status?: string
        }
        Update: {
          bonus_amount?: number | null
          bonus_paid?: boolean | null
          candidate_id?: string
          company_id?: string
          created_at?: string
          id?: string
          job_id?: string | null
          notes?: string | null
          referral_date?: string | null
          referrer_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_referrals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "recruitment_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_referrals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_referrals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "recruitment_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_requisitions: {
        Row: {
          business_justification: string | null
          company_id: string
          created_at: string
          created_by: string | null
          currency: string | null
          department_id: number | null
          education: string | null
          employment_type: string
          hiring_manager_id: string | null
          id: string
          is_replacement: boolean | null
          job_description: string | null
          location: string
          max_experience: number | null
          min_experience: number | null
          position_title: string
          preferred_skills: string[] | null
          priority: string
          rejection_reason: string | null
          replacement_employee_id: string | null
          reporting_manager_id: string | null
          required_date: string | null
          required_skills: string[] | null
          requisition_no: string
          salary_max: number | null
          salary_min: number | null
          status: string
          updated_at: string
          vacancies: number
          workflow_instance_id: string | null
        }
        Insert: {
          business_justification?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department_id?: number | null
          education?: string | null
          employment_type?: string
          hiring_manager_id?: string | null
          id?: string
          is_replacement?: boolean | null
          job_description?: string | null
          location: string
          max_experience?: number | null
          min_experience?: number | null
          position_title: string
          preferred_skills?: string[] | null
          priority?: string
          rejection_reason?: string | null
          replacement_employee_id?: string | null
          reporting_manager_id?: string | null
          required_date?: string | null
          required_skills?: string[] | null
          requisition_no: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          updated_at?: string
          vacancies?: number
          workflow_instance_id?: string | null
        }
        Update: {
          business_justification?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          department_id?: number | null
          education?: string | null
          employment_type?: string
          hiring_manager_id?: string | null
          id?: string
          is_replacement?: boolean | null
          job_description?: string | null
          location?: string
          max_experience?: number | null
          min_experience?: number | null
          position_title?: string
          preferred_skills?: string[] | null
          priority?: string
          rejection_reason?: string | null
          replacement_employee_id?: string | null
          reporting_manager_id?: string | null
          required_date?: string | null
          required_skills?: string[] | null
          requisition_no?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          updated_at?: string
          vacancies?: number
          workflow_instance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_requisitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_requisitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_requisitions_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_requisitions_replacement_employee_id_fkey"
            columns: ["replacement_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_requisitions_reporting_manager_id_fkey"
            columns: ["reporting_manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_scorecards: {
        Row: {
          company_id: string
          created_at: string
          criteria: Json
          department_id: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          criteria?: Json
          department_id?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          criteria?: Json
          department_id?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_scorecards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_scorecards_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_skills_master: {
        Row: {
          aliases: string[] | null
          category: string | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          aliases?: string[] | null
          category?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          aliases?: string[] | null
          category?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_skills_master_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_sources: {
        Row: {
          channel_type: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          channel_type?: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          channel_type?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      recruitment_stage_history: {
        Row: {
          application_id: string
          changed_by: string | null
          company_id: string
          created_at: string
          id: string
          new_stage: string
          old_stage: string | null
          reason_or_notes: string | null
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          new_stage: string
          old_stage?: string | null
          reason_or_notes?: string | null
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          new_stage?: string
          old_stage?: string | null
          reason_or_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recruitment_stage_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "recruitment_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recruitment_stage_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          company_id: string
          id: string
          is_active: boolean | null
          name: string
          recipients_config: Json | null
          schedule_config: Json | null
          target_filter: Json | null
          type: string
        }
        Insert: {
          company_id?: string
          id?: string
          is_active?: boolean | null
          name: string
          recipients_config?: Json | null
          schedule_config?: Json | null
          target_filter?: Json | null
          type: string
        }
        Update: {
          company_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          recipients_config?: Json | null
          schedule_config?: Json | null
          target_filter?: Json | null
          type?: string
        }
        Relationships: []
      }
      report_definitions: {
        Row: {
          company_id: string
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          module: string
          name: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          config: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          module: string
          name: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          module?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      report_schema_registry: {
        Row: {
          created_at: string | null
          data_type: string
          field_key: string
          field_label: string
          id: string
          is_filterable: boolean | null
          is_sortable: boolean | null
          module: string
          source_table: string | null
        }
        Insert: {
          created_at?: string | null
          data_type: string
          field_key: string
          field_label: string
          id?: string
          is_filterable?: boolean | null
          is_sortable?: boolean | null
          module: string
          source_table?: string | null
        }
        Update: {
          created_at?: string | null
          data_type?: string
          field_key?: string
          field_label?: string
          id?: string
          is_filterable?: boolean | null
          is_sortable?: boolean | null
          module?: string
          source_table?: string | null
        }
        Relationships: []
      }
      resignations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attachment_name: string | null
          attachment_url: string | null
          company_id: string
          created_at: string
          employee_id: string | null
          exit_status: string | null
          id: string
          manager_comment: string | null
          notice_period_days: number | null
          proposed_last_working_date: string | null
          reason_category: string | null
          reason_text: string | null
          relieving_date: string | null
          separation_type: string | null
          settlement_status: string | null
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          exit_status?: string | null
          id?: string
          manager_comment?: string | null
          notice_period_days?: number | null
          proposed_last_working_date?: string | null
          reason_category?: string | null
          reason_text?: string | null
          relieving_date?: string | null
          separation_type?: string | null
          settlement_status?: string | null
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          exit_status?: string | null
          id?: string
          manager_comment?: string | null
          notice_period_days?: number | null
          proposed_last_working_date?: string | null
          reason_category?: string | null
          reason_text?: string | null
          relieving_date?: string | null
          separation_type?: string | null
          settlement_status?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resignations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resignations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          permissions: string[] | null
          scope: string | null
          status: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          permissions?: string[] | null
          scope?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          permissions?: string[] | null
          scope?: string | null
          status?: string | null
        }
        Relationships: []
      }
      sales_order_lines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          item_id: string
          order_id: string | null
          quantity: number
          quantity_delivered: number | null
          reservation_id: string | null
          subtotal: number | null
          unit_price: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          item_id: string
          order_id?: string | null
          quantity: number
          quantity_delivered?: number | null
          reservation_id?: string | null
          subtotal?: number | null
          unit_price?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          item_id?: string
          order_id?: string | null
          quantity?: number
          quantity_delivered?: number | null
          reservation_id?: string | null
          subtotal?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_lines_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          commitment_date: string | null
          company_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          order_date: string | null
          partner_id: string
          state: string | null
          total_amount: number | null
          warehouse_id: string | null
        }
        Insert: {
          commitment_date?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          order_date?: string | null
          partner_id: string
          state?: string | null
          total_amount?: number | null
          warehouse_id?: string | null
        }
        Update: {
          commitment_date?: string | null
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          order_date?: string | null
          partner_id?: string
          state?: string | null
          total_amount?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "accounting_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sla_tracking: {
        Row: {
          company_id: string
          completed_time: string | null
          created_at: string | null
          due_time: string
          entity_id: string
          entity_type: string
          id: string
          sla_hours: number
          start_time: string | null
          status: string | null
        }
        Insert: {
          company_id?: string
          completed_time?: string | null
          created_at?: string | null
          due_time: string
          entity_id: string
          entity_type: string
          id?: string
          sla_hours?: number
          start_time?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string
          completed_time?: string | null
          created_at?: string | null
          due_time?: string
          entity_id?: string
          entity_type?: string
          id?: string
          sla_hours?: number
          start_time?: string | null
          status?: string | null
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          alert_type: string
          company_id: string
          created_at: string
          current_qty: number | null
          id: string
          is_resolved: boolean | null
          item_id: string | null
          message: string
          metadata: Json | null
          reorder_level: number | null
          resolved_at: string | null
          severity: string | null
          warehouse_id: string | null
        }
        Insert: {
          alert_type: string
          company_id?: string
          created_at?: string
          current_qty?: number | null
          id?: string
          is_resolved?: boolean | null
          item_id?: string | null
          message: string
          metadata?: Json | null
          reorder_level?: number | null
          resolved_at?: string | null
          severity?: string | null
          warehouse_id?: string | null
        }
        Update: {
          alert_type?: string
          company_id?: string
          created_at?: string
          current_qty?: number | null
          id?: string
          is_resolved?: boolean | null
          item_id?: string | null
          message?: string
          metadata?: Json | null
          reorder_level?: number | null
          resolved_at?: string | null
          severity?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          from_bin_id: string | null
          id: string
          item_id: string | null
          movement_type: string
          performed_by: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
          to_bin_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          from_bin_id?: string | null
          id?: string
          item_id?: string | null
          movement_type: string
          performed_by?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          to_bin_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          from_bin_id?: string | null
          id?: string
          item_id?: string | null
          movement_type?: string
          performed_by?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          to_bin_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_from_bin_id_fkey"
            columns: ["from_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_bin_id_fkey"
            columns: ["to_bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_required: boolean | null
          options: Json | null
          question_text: string
          question_type: string
          survey_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          options?: Json | null
          question_text: string
          question_type: string
          survey_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          options?: Json | null
          question_text?: string
          question_type?: string
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          company_id: string
          created_at: string
          employee_id: string | null
          id: string
          responses: Json | null
          survey_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          responses?: Json | null
          survey_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          employee_id?: string | null
          id?: string
          responses?: Json | null
          survey_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          expiration_date: string | null
          id: string
          is_active: boolean | null
          title: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          expiration_date?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
        }
        Relationships: []
      }
      taxes: {
        Row: {
          account_id: string | null
          amount: number
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          refund_account_id: string | null
          scope: string | null
          type: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          refund_account_id?: string | null
          scope?: string | null
          type?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          refund_account_id?: string | null
          scope?: string | null
          type?: string | null
        }
        Relationships: []
      }
      tickets: {
        Row: {
          assigned_to: string | null
          attachment_name: string | null
          attachment_url: string | null
          category: string | null
          company_id: string
          created_at: string
          description: string | null
          employee_id: string | null
          id: string
          priority: string | null
          status: string | null
          subject: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          assigned_to?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          category?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          employee_id?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_tracking: {
        Row: {
          approval_status: string | null
          company_id: string
          condition_status: string | null
          created_at: string | null
          date_out: string
          date_returned: string | null
          department_id: string | null
          department_name: string | null
          employee_id: string | null
          employee_name: string | null
          expected_return_date: string | null
          id: string
          item_code: string | null
          project_name: string | null
          quantity_out: number | null
          quantity_returned: number | null
          remarks_in: string | null
          remarks_out: string | null
          serial_number: string | null
          tool_name: string
        }
        Insert: {
          approval_status?: string | null
          company_id?: string
          condition_status?: string | null
          created_at?: string | null
          date_out?: string
          date_returned?: string | null
          department_id?: string | null
          department_name?: string | null
          employee_id?: string | null
          employee_name?: string | null
          expected_return_date?: string | null
          id?: string
          item_code?: string | null
          project_name?: string | null
          quantity_out?: number | null
          quantity_returned?: number | null
          remarks_in?: string | null
          remarks_out?: string | null
          serial_number?: string | null
          tool_name: string
        }
        Update: {
          approval_status?: string | null
          company_id?: string
          condition_status?: string | null
          created_at?: string | null
          date_out?: string
          date_returned?: string | null
          department_id?: string | null
          department_name?: string | null
          employee_id?: string | null
          employee_name?: string | null
          expected_return_date?: string | null
          id?: string
          item_code?: string | null
          project_name?: string | null
          quantity_out?: number | null
          quantity_returned?: number | null
          remarks_in?: string | null
          remarks_out?: string | null
          serial_number?: string | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_tracking_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_company_access: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_default: boolean | null
          role_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          role_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          role_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_uca_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_company_access_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          company_id: string
          created_at: string | null
          granted: boolean | null
          id: number
          permission: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          granted?: boolean | null
          id?: number
          permission: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          granted?: boolean | null
          id?: number
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_bins: {
        Row: {
          capacity: number | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          zone_id: string | null
        }
        Insert: {
          capacity?: number | null
          code: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          zone_id?: string | null
        }
        Update: {
          capacity?: number | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bins_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "warehouse_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_zones: {
        Row: {
          code: string
          company_id: string
          created_at: string
          id: string
          name: string
          warehouse_id: string | null
          zone_type: string | null
        }
        Insert: {
          code: string
          company_id?: string
          created_at?: string
          id?: string
          name: string
          warehouse_id?: string | null
          zone_type?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          warehouse_id?: string | null
          zone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_zones_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      workflow_action_logs: {
        Row: {
          action: string
          actor_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          instance_id: string | null
          step_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          step_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_action_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_action_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "workflow_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_action_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_instances: {
        Row: {
          assigned_to_role_id: string | null
          assigned_to_user_id: string | null
          company_id: string
          created_at: string | null
          current_step_id: string | null
          entity_id: string
          id: string
          module: string
          requester_id: string | null
          status: string
          trigger_type: string
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          assigned_to_role_id?: string | null
          assigned_to_user_id?: string | null
          company_id: string
          created_at?: string | null
          current_step_id?: string | null
          entity_id: string
          id?: string
          module: string
          requester_id?: string | null
          status?: string
          trigger_type: string
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          assigned_to_role_id?: string | null
          assigned_to_user_id?: string | null
          company_id?: string
          created_at?: string | null
          current_step_id?: string | null
          entity_id?: string
          id?: string
          module?: string
          requester_id?: string | null
          status?: string
          trigger_type?: string
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_instances_assigned_to_role_id_fkey"
            columns: ["assigned_to_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_instances_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_levels: {
        Row: {
          approver_ids: string[] | null
          approver_logic: string | null
          approver_type: string
          company_id: string
          created_at: string
          id: string
          level_name: string
          level_order: number
          workflow_id: string | null
        }
        Insert: {
          approver_ids?: string[] | null
          approver_logic?: string | null
          approver_type: string
          company_id?: string
          created_at?: string
          id?: string
          level_name: string
          level_order: number
          workflow_id?: string | null
        }
        Update: {
          approver_ids?: string[] | null
          approver_logic?: string | null
          approver_type?: string
          company_id?: string
          created_at?: string
          id?: string
          level_name?: string
          level_order?: number
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_levels_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_requests: {
        Row: {
          company_id: string
          created_at: string
          current_step: number | null
          id: string
          requester_id: string | null
          source_id: string
          status: string | null
          workflow_id: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          current_step?: number | null
          id?: string
          requester_id?: string | null
          source_id: string
          status?: string | null
          workflow_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          current_step?: number | null
          id?: string
          requester_id?: string | null
          source_id?: string
          status?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_requests_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          approver_role_id: string | null
          created_at: string | null
          id: string
          is_final_step: boolean | null
          name: string
          step_order: number
          type: string | null
          workflow_id: string | null
        }
        Insert: {
          approver_role_id?: string | null
          created_at?: string | null
          id?: string
          is_final_step?: boolean | null
          name: string
          step_order: number
          type?: string | null
          workflow_id?: string | null
        }
        Update: {
          approver_role_id?: string | null
          created_at?: string | null
          id?: string
          is_final_step?: boolean | null
          name?: string
          step_order?: number
          type?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_approver_role_id_fkey"
            columns: ["approver_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          company_id: string
          created_at: string
          criteria: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          level_order_type: string | null
          module: string
          name: string
          trigger_type: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_order_type?: string | null
          module: string
          name: string
          trigger_type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          criteria?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          level_order_type?: string | null
          module?: string
          name?: string
          trigger_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_hr_payroll_reports: {
        Row: {
          basic_salary: number | null
          company_id: string | null
          department_name: string | null
          early_count: number | null
          early_deduction: number | null
          employee_code: string | null
          employee_name: string | null
          fixed_allowance: number | null
          gross_earning: number | null
          id: string | null
          late_count: number | null
          late_deduction: number | null
          loan_deduction: number | null
          lop_days: number | null
          month_year: string | null
          net_pay: number | null
          ot_amount: number | null
          ot_hours: number | null
          payable_days: number | null
          status: string | null
          total_deduction: number | null
          variable_allowance: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_create_user: {
        Args: {
          p_company_id: string
          p_email: string
          p_employee_id?: string
          p_full_name: string
          p_password: string
          p_role: string
          p_role_id: string
        }
        Returns: Json
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: Json }
      admin_update_user: {
        Args: {
          p_employee_id?: string
          p_full_name: string
          p_role: string
          p_user_id: string
        }
        Returns: undefined
      }
      apply_job_transition: {
        Args: { p_transition_id: string }
        Returns: boolean
      }
      approve_job_transition: {
        Args: { p_approver_notes: string; p_transition_id: string }
        Returns: boolean
      }
      check_and_process_overdue_slas: { Args: never; Returns: undefined }
      fn_calculate_shift_duration: {
        Args: {
          p_end_time: string
          p_is_overnight?: boolean
          p_start_time: string
        }
        Returns: number
      }
      fn_seed_client_chart_of_accounts: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      get_current_company_id: { Args: never; Returns: string }
      get_database_schema_info: { Args: never; Returns: Json }
      get_my_company_id: { Args: never; Returns: string }
      get_period_for_date: {
        Args: { p_company_id: string; p_date: string }
        Returns: string
      }
      rpc_apply_adjustment: {
        Args: { p_adjustment_id: string; p_user_id: string }
        Returns: Json
      }
      rpc_ar_aging: { Args: { p_company_id: string }; Returns: Json }
      rpc_bulk_import_items: {
        Args: { p_company_id: string; p_items: Json }
        Returns: Json
      }
      rpc_cancel_production_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_cancel_purchase_order: { Args: { p_order_id: string }; Returns: Json }
      rpc_cancel_sales_order: { Args: { p_order_id: string }; Returns: Json }
      rpc_complete_production: {
        Args: { p_order_id: string; p_qty_produced?: number }
        Returns: Json
      }
      rpc_confirm_production_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_confirm_purchase_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_confirm_sales_order: { Args: { p_order_id: string }; Returns: Json }
      rpc_create_accounting_invoice:
        | {
            Args: {
              p_date: string
              p_due_date: string
              p_journal_id: string
              p_lines: Json
              p_move_type: string
              p_partner_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_journal_id: string
              p_lines: Json
              p_move_type: string
              p_partner_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_journal_id: string
              p_lines: Json
              p_move_type: string
              p_partner_id: string
              p_reference?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_invoice_date?: string
              p_journal_id: string
              p_lines: Json
              p_move_type: string
              p_partner_id: string
              p_reference?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_invoice_date?: string
              p_journal_id: string
              p_lines: Json
              p_move_type: string
              p_partner_id: string
              p_reference?: string
              p_supplier_invoice_number?: string
            }
            Returns: string
          }
      rpc_create_invoice: {
        Args: {
          p_date: string
          p_due_date: string
          p_journal_id: string
          p_lines: Json
          p_move_type: string
          p_partner_id: string
        }
        Returns: string
      }
      rpc_create_production_order: {
        Args: {
          p_bom_id: string
          p_date_planned: string
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_work_center_id?: string
        }
        Returns: Json
      }
      rpc_create_purchase_order: {
        Args: {
          p_expected_date: string
          p_lines?: Json
          p_notes?: string
          p_partner_id: string
          p_warehouse_id?: string
        }
        Returns: Json
      }
      rpc_create_sales_order: {
        Args: {
          p_commitment_date?: string
          p_lines?: Json
          p_notes?: string
          p_partner_id: string
          p_warehouse_id?: string
        }
        Returns: Json
      }
      rpc_dispose_asset: {
        Args: {
          p_asset_id: string
          p_disposal_date: string
          p_disposal_value?: number
        }
        Returns: Json
      }
      rpc_execute_attendance_processing: {
        Args: { p_company_id: string; p_month_year: string; p_user_id?: string }
        Returns: Json
      }
      rpc_finalize_attendance_period: {
        Args: { p_company_id: string; p_period_id: string; p_user_id?: string }
        Returns: Json
      }
      rpc_finalize_payroll_run: {
        Args: {
          p_company_id: string
          p_lock_reason?: string
          p_payroll_run_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      rpc_finance_dashboard_summary: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_find_putaway_bin: {
        Args: { p_item_id: string; p_qty?: number; p_warehouse_id: string }
        Returns: string
      }
      rpc_fix_my_access: { Args: never; Returns: string }
      rpc_fixed_assets_summary: { Args: never; Returns: Json }
      rpc_generate_payroll: {
        Args: { p_company_id: string; p_month_year: string }
        Returns: string
      }
      rpc_generate_stock_alerts: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_get_accounting_account_balance: {
        Args: { p_account_id: string; p_date: string }
        Returns: number
      }
      rpc_get_accounting_balance_sheet:
        | { Args: { p_date: string }; Returns: Json }
        | { Args: { p_company_id?: string; p_date: string }; Returns: Json }
      rpc_get_accounting_expense_analysis:
        | { Args: { p_end_date: string; p_start_date: string }; Returns: Json }
        | {
            Args: {
              p_company_id?: string
              p_end_date: string
              p_start_date: string
            }
            Returns: Json
          }
      rpc_get_accounting_partner_aging: {
        Args: { p_date: string; p_partner_type: string }
        Returns: Json
      }
      rpc_get_accounting_profit_loss:
        | { Args: { p_end_date: string; p_start_date: string }; Returns: Json }
        | {
            Args: {
              p_company_id?: string
              p_contract_cost_center_id?: string
              p_cost_center_id?: string
              p_end_date: string
              p_project_cost_center_id?: string
              p_start_date: string
            }
            Returns: Json
          }
      rpc_get_accounting_purchase_ledger_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      rpc_get_accounting_sales_ledger_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      rpc_get_accounting_trial_balance:
        | { Args: { p_date: string }; Returns: Json }
        | { Args: { p_company_id?: string; p_date: string }; Returns: Json }
      rpc_get_balance_sheet: { Args: { p_date: string }; Returns: Json }
      rpc_get_cash_book: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      rpc_get_device_sync_status: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_get_inventory_valuation: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_get_late_early_report: {
        Args: {
          p_company_id: string
          p_department_id?: number
          p_employee_id?: string
          p_end_date: string
          p_min_early_minutes?: number
          p_min_late_minutes?: number
          p_start_date: string
        }
        Returns: Json
      }
      rpc_get_monthly_attendance_report: {
        Args: {
          p_company_id: string
          p_department_id?: number
          p_employee_id?: string
          p_end_date: string
          p_location_id?: number
          p_shift_id?: number
          p_start_date: string
        }
        Returns: Json
      }
      rpc_get_my_approvals: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          module: string
          request_id: string
          requester_name: string
          source_id: string
          status: string
          workflow_name: string
        }[]
      }
      rpc_get_overtime_report: {
        Args: {
          p_approval_status?: string
          p_company_id: string
          p_department_id?: number
          p_employee_id?: string
          p_end_date: string
          p_start_date: string
        }
        Returns: Json
      }
      rpc_get_partner_aging: {
        Args: { p_date: string; p_partner_type: string }
        Returns: Json
      }
      rpc_get_profit_loss: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      rpc_get_qatar_vat_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      rpc_get_stock_level: {
        Args: { p_company_id: string }
        Returns: {
          available_qty: number
          barcode: string
          current_qty: number
          expiry_date: string
          item_code: string
          item_id: string
          item_name: string
          reorder_level: number
          reserved_qty: number
          uom: string
          warehouse_id: string
          warehouse_name: string
          weight: number
        }[]
      }
      rpc_get_trial_balance: { Args: { p_date: string }; Returns: Json }
      rpc_get_user_companies: {
        Args: never
        Returns: {
          company_code: string
          company_id: string
          company_name: string
          group_name: string
          is_default: boolean
          role_name: string
        }[]
      }
      rpc_global_dashboard: { Args: { p_company_id: string }; Returns: Json }
      rpc_inventory_dashboard_summary: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_invoice_sales_order: { Args: { p_order_id: string }; Returns: Json }
      rpc_lock_attendance_period: {
        Args: {
          p_company_id: string
          p_lock_reason?: string
          p_period_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      rpc_manufacturing_summary: { Args: never; Returns: Json }
      rpc_mark_all_present: {
        Args: { p_company_id: string; p_date: string }
        Returns: string
      }
      rpc_post_accounting_entry: { Args: { p_entry_id: string }; Returns: Json }
      rpc_post_accounting_payment: {
        Args: { p_payment_id: string }
        Returns: string
      }
      rpc_post_move: {
        Args: { p_move_id: string; p_user_id: string }
        Returns: Json
      }
      rpc_post_payment: { Args: { p_payment_id: string }; Returns: string }
      rpc_preprocess_salary: {
        Args: {
          p_company_id: string
          p_payroll_run_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      rpc_process_payroll_final: {
        Args: {
          p_company_id: string
          p_payroll_run_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      rpc_process_stock_movement: {
        Args: {
          p_company_id: string
          p_from_bin_id: string
          p_item_id: string
          p_movement_type: string
          p_qty: number
          p_ref_id: string
          p_ref_type: string
          p_to_bin_id: string
          p_unit_cost?: number
        }
        Returns: Json
      }
      rpc_procurement_summary: { Args: never; Returns: Json }
      rpc_punch_action: {
        Args: { p_company_id: string; p_employee_id: string }
        Returns: string
      }
      rpc_recalculate_attendance_shift_rules: {
        Args: { p_company_id: string; p_end_date: string; p_start_date: string }
        Returns: Json
      }
      rpc_receive_purchase_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_reconcile_statement_line: {
        Args: { p_payment_id: string; p_statement_line_id: string }
        Returns: undefined
      }
      rpc_reopen_attendance_period: {
        Args: {
          p_company_id: string
          p_period_id: string
          p_reopen_reason: string
          p_user_id?: string
        }
        Returns: Json
      }
      rpc_revenue_expense_trend: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_run_depreciation: { Args: { p_period_date: string }; Returns: Json }
      rpc_run_leave_accrual: {
        Args: { p_company_id: string; p_year?: number }
        Returns: number
      }
      rpc_seed_accounting_masters: {
        Args: { v_company_id: string }
        Returns: undefined
      }
      rpc_seed_company_data: {
        Args: { v_company_id: string }
        Returns: undefined
      }
      rpc_seed_company_data_wrapper: {
        Args: { v_company_id: string }
        Returns: undefined
      }
      rpc_seed_vat_demo_data: {
        Args: { p_target_company_id?: string }
        Returns: Json
      }
      rpc_ship_sales_order: { Args: { p_order_id: string }; Returns: Json }
      rpc_start_production_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      rpc_stock_movement_trend: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_submit_workflow_request: {
        Args: {
          p_requester_id: string
          p_source_id: string
          p_workflow_id: string
        }
        Returns: string
      }
      rpc_sync_approved_missed_punches: {
        Args: { p_company_id?: string }
        Returns: Json
      }
      rpc_sync_device_attendance: {
        Args: { p_company_id: string }
        Returns: Json
      }
      rpc_transfer_attendance_to_payroll: {
        Args: {
          p_attendance_period_id: string
          p_company_id: string
          p_user_id?: string
        }
        Returns: Json
      }
      rpc_update_accounting_invoice:
        | {
            Args: {
              p_date: string
              p_due_date: string
              p_entry_id: string
              p_journal_id: string
              p_lines: Json
              p_partner_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_entry_id: string
              p_journal_id: string
              p_lines: Json
              p_partner_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_entry_id: string
              p_journal_id: string
              p_lines: Json
              p_partner_id: string
              p_reference?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_entry_id: string
              p_invoice_date?: string
              p_journal_id: string
              p_lines: Json
              p_partner_id: string
              p_reference?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_company_id?: string
              p_date: string
              p_due_date: string
              p_entry_id: string
              p_invoice_date?: string
              p_journal_id: string
              p_lines: Json
              p_partner_id: string
              p_reference?: string
              p_supplier_invoice_number?: string
            }
            Returns: undefined
          }
      rpc_vote_poll: {
        Args: { p_employee_id: string; p_option_id: string; p_poll_id: string }
        Returns: undefined
      }
      rpc_workflow_action: {
        Args: { p_action: string; p_comment: string; p_request_id: string }
        Returns: string
      }
      submit_job_transition: {
        Args: {
          p_current_data: Json
          p_effective_date: string
          p_employee_id: string
          p_new_data: Json
          p_reason: string
          p_remarks: string
          p_transition_type: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
