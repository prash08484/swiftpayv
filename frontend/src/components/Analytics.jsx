import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "../utils/axios";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Analytics Dashboard Component
 * Displays transaction statistics and charts
 */
export const Analytics = () => {
  const [stats, setStats] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(false);

  const user = useSelector((state) => state.user);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch stats
      const statsResponse = await axios.get("/transactions/stats");
      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      // Fetch monthly data
      const monthlyResponse = await axios.get("/transactions/monthly?months=6");
      if (monthlyResponse.data.success) {
        setMonthlyData(monthlyResponse.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Sent */}
        <motion.div
          whileHover={{ y: -5 }}
          className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Total Sent</p>
              <p className="text-2xl font-bold text-red-900 mt-2">₹{stats.totalSent.toLocaleString()}</p>
            </div>
            <div className="text-4xl text-red-300">📤</div>
          </div>
        </motion.div>

        {/* Total Received */}
        <motion.div
          whileHover={{ y: -5 }}
          className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Received</p>
              <p className="text-2xl font-bold text-green-900 mt-2">₹{stats.totalReceived.toLocaleString()}</p>
            </div>
            <div className="text-4xl text-green-300">📥</div>
          </div>
        </motion.div>

        {/* Total Transactions */}
        <motion.div
          whileHover={{ y: -5 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 shadow-md"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Transactions</p>
              <p className="text-2xl font-bold text-blue-900 mt-2">{stats.transactionCount}</p>
            </div>
            <div className="text-4xl text-blue-300">💱</div>
          </div>
        </motion.div>
      </div>

      {/* Monthly Breakdown Chart */}
      {monthlyData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Breakdown (6 Months)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={monthlyData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                formatter={(value) => `₹${value.toLocaleString()}`}
                contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="sent"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: "#ef4444", r: 4 }}
                name="Sent"
              />
              <Line
                type="monotone"
                dataKey="received"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
                name="Received"
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Transaction Count Chart */}
      {monthlyData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Count Per Month</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={monthlyData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip
                contentStyle={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb" }}
              />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="Transactions" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-lg shadow-md p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Average Sent:</span> ₹
              {(stats.totalSent / Math.max(1, stats.transactionCount / 2)).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Average Received:</span> ₹
              {(stats.totalReceived / Math.max(1, stats.transactionCount / 2)).toFixed(2)}
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Net Balance (Virtual):</span>
              <span className={stats.totalReceived - stats.totalSent >= 0 ? "text-green-600" : "text-red-600"}>
                {" "}₹{(stats.totalReceived - stats.totalSent).toLocaleString()}
              </span>
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Total Transactions:</span> {stats.transactionCount}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Analytics;
