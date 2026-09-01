import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import axios from "../utils/axios";
import { Check, X, Plus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";

/**
 * Payment Request Component
 * Send and manage payment requests
 */
export const PaymentRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({ targetId: "", amount: "", note: "" });
  const [users, setUsers] = useState([]);

  const user = useSelector((state) => state.user);

  useEffect(() => {
    fetchRequests();
    fetchUsers();
  }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/requests");
      if (response.data.success) {
        setRequests(response.data.data.requests);
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
      toast.error("Failed to load payment requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get("/user/bulk", { params: { filter: "" } });
      if (response.data.success) {
        setUsers(response.data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!formData.targetId || !formData.amount) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const response = await axios.post("/requests", {
        targetId: formData.targetId,
        amount: parseFloat(formData.amount),
        note: formData.note
      });

      if (response.data.success) {
        toast.success("Payment request sent!");
        setFormData({ targetId: "", amount: "", note: "" });
        setShowCreate(false);
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to create request:", error);
      toast.error(error.response?.data?.error || "Failed to create request");
    }
  };

  const handleAccept = async (requestId) => {
    try {
      const response = await axios.post(`/requests/${requestId}/accept`);
      if (response.data.success) {
        toast.success("Payment request accepted!");
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to accept request:", error);
      toast.error(error.response?.data?.error || "Failed to accept request");
    }
  };

  const handleReject = async (requestId) => {
    try {
      const response = await axios.post(`/requests/${requestId}/reject`);
      if (response.data.success) {
        toast.success("Payment request rejected");
        fetchRequests();
      }
    } catch (error) {
      console.error("Failed to reject request:", error);
      toast.error(error.response?.data?.error || "Failed to reject request");
    }
  };

  const incomingRequests = requests.filter((r) => r.target._id === user.userId && r.status === "pending");
  const outgoingRequests = requests.filter((r) => r.requester._id === user.userId && r.status === "pending");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Create Request Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowCreate(!showCreate)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Send Payment Request
      </motion.button>

      {/* Create Request Form */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-6 rounded-lg shadow-md"
        >
          <h3 className="text-lg font-semibold mb-4">Create Payment Request</h3>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User
              </label>
              <select
                value={formData.targetId}
                onChange={(e) => setFormData({ ...formData, targetId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a user</option>
                {users
                  .filter((u) => u._id !== user.userId)
                  .map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.firstName} {u.lastName} (@{u.username})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (₹)
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note (Optional)
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="Add a note..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                maxLength="500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Send Request
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-lg shadow-md overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Incoming Requests ({incomingRequests.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {incomingRequests.map((request) => (
              <motion.div
                key={request._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {request.requester?.firstName} {request.requester?.lastName} is requesting ₹{request.amount}
                    </p>
                    {request.note && (
                      <p className="text-sm text-gray-600 mt-1">{request.note}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAccept(request._id)}
                      className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors"
                      title="Accept"
                    >
                      <Check className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleReject(request._id)}
                      className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                      title="Reject"
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Outgoing Requests */}
      {outgoingRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-lg shadow-md overflow-hidden"
        >
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Outgoing Requests ({outgoingRequests.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200">
            {outgoingRequests.map((request) => (
              <motion.div
                key={request._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    Requesting ₹{request.amount} from {request.target?.firstName} {request.target?.lastName}
                  </p>
                  {request.note && (
                    <p className="text-sm text-gray-600 mt-1">{request.note}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                  <span className="inline-block mt-3 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                    Awaiting Response
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* No Requests */}
      {requests.length === 0 && !showCreate && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No active payment requests</p>
        </div>
      )}
    </motion.div>
  );
};

export default PaymentRequests;
