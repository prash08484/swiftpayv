import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "../utils/axios";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Transaction History Component
 * Displays paginated list of all transactions
 */
export const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);

  const user = useSelector((state) => state.user);

  useEffect(() => {
    fetchTransactions();
  }, [page]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/transactions", {
        params: { limit, page }
      });

      if (response.data.success) {
        setTransactions(response.data.data.transactions);
        setTotalPages(response.data.data.pages);
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionLabel = (transaction) => {
    if (transaction.sender?._id === user.userId) {
      return `Sent to ${transaction.receiver?.username}`;
    } else {
      return `Received from ${transaction.sender?.username}`;
    }
  };

  const isOutgoing = (transaction) => transaction.sender?._id === user.userId;

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No transactions yet</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-md overflow-hidden"
    >
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Transaction History</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Type</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">User</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Amount</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Date</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((transaction) => (
              <motion.tr
                key={transaction._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-gray-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {isOutgoing(transaction) ? (
                      <div className="p-2 bg-red-100 rounded-full">
                        <ArrowUpRight className="w-4 h-4 text-red-600" />
                      </div>
                    ) : (
                      <div className="p-2 bg-green-100 rounded-full">
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {isOutgoing(transaction) ? "Sent" : "Received"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">{getTransactionLabel(transaction)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-semibold ${isOutgoing(transaction) ? "text-red-600" : "text-green-600"}`}>
                    {isOutgoing(transaction) ? "-" : "+"}₹{transaction.amount}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{formatDate(transaction.createdAt)}</span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      transaction.status === "success"
                        ? "bg-green-100 text-green-800"
                        : transaction.status === "pending"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <span className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </span>

        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </motion.div>
  );
};

export default TransactionHistory;
