// "use client";

// // Make sure the path to your table component is correct.
// // It should likely be in `@/components/private/transactions/TransactionTable`
// import TransactionTable from "@/components/private/transactions/enhanced_table/TransactionTable";
// import { useState, useEffect } from "react";

// //
// // THIS IS THE FIX: We are forcing this page to use the one, correct Transaction type.
// //
// import type { Transaction } from "@/types/transactions";

// // This mock function simulates fetching data from Supabase.
// async function fetchTransactions(): Promise<Transaction[]> {
//   // This mock data now correctly conforms to the imported Transaction type.
//   // I have added all the required fields.
//   const mockData: Transaction[] = [
//     {
//       date: "2025-07-05",
//       transaction_number: "809350",
//       amount: -45.44,
//       merchant_name: "Autozone",
//       category_name: "Repairs & Maintenance",
//       category_icon: "Wrench", // Added this required field
//       needs_review: false,
//       account_id: "acc_1a2b3c4d",
//       original_description: "AUTOZONE 2732 PHOENIX AZ",
//       match_method: "regex", // Added this required field
//       user_metadata: { Memo: "Debit Card" },
//       logo_url: "https://logo.clearbit.com/autozone.com",
//     },
//     {
//       date: "2025-07-05",
//       transaction_number: "558764",
//       amount: -4.13,
//       merchant_name: "Panera Bread",
//       category_name: "Food & Dining",
//       category_icon: "Utensils", // Added this required field
//       needs_review: true,
//       account_id: "acc_1a2b3c4d",
//       original_description: "PANERA BREAD #601829 O 602-274-0290 AZ",
//       match_method: "regex", // Added this required field
//       logo_url: "https://logo.clearbit.com/panerabread.com",
//     },
//     {
//       date: "2025-07-02",
//       transaction_number: "1547154",
//       amount: 5000.0,
//       merchant_name: "Paycheck",
//       category_name: "Income",
//       category_icon: "DollarSign", // Added this required field
//       needs_review: false,
//       account_id: "acc_1a2b3c4d",
//       original_description: "DEPOSIT MIDFIRST BANK",
//       match_method: "manual", // Added this required field
//       logo_url: undefined,
//     },
//   ];
//   return new Promise((resolve) => setTimeout(() => resolve(mockData), 1000));
// }

// export default function TransactionsTestPage() {
//   const [transactions, setTransactions] = useState<Transaction[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetchTransactions().then((data) => {
//       setTransactions(data);
//       setLoading(false);
//     });
//   }, []);

//   const handleEdit = (transaction: Transaction) => {
//     console.log("Editing transaction:", transaction.transaction_number);
//   };

//   const handleDelete = (transaction: Transaction) => {
//     console.log("Deleting transaction:", transaction.transaction_number);
//   };

//   if (loading) {
//     return <div>Loading transactions...</div>;
//   }

//   return (
//     <div className="p-6">
//       <TransactionTable
//         transactions={transactions}
//         allCount={transactions.length}
//       />
//     </div>
//   );
// }
