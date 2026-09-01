import { useEffect } from "react";
import Topnav from "./templates/Topnav";
import UserDetails from "./templates/UserDetails";
import { useDispatch, useSelector } from "react-redux";
import { removeUser } from "../store/reducers/userSlice";
import { Outlet, Navigate } from "react-router-dom";
import { clearToken, clearStoredUser, getToken } from "../utils/auth";
import { toast } from "react-toastify";
import useSocket from "../hooks/useSocket";

const Dashboard = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user.info);
  const { isConnected, onPaymentReceived, onPaymentRequest, onRequestAccepted, onRequestRejected, onPaymentCompleted } = useSocket();

  useEffect(() => {
    const cleanups = [
      onPaymentReceived((data) => toast.success(`Received ₹${data.amount} from ${data.senderName}`)),
      onPaymentRequest((data) => toast.info(`${data.requesterName} requested ₹${data.amount}`)),
      onRequestAccepted(() => toast.success("Your payment request was accepted")),
      onRequestRejected(() => toast.error("Your payment request was rejected")),
      onPaymentCompleted((data) => toast.success(`Payment of ₹${data.amount} completed`)),
    ].filter(Boolean);

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [isConnected, onPaymentReceived, onPaymentRequest, onRequestAccepted, onRequestRejected, onPaymentCompleted]);

  useEffect(() => {
    return () => {
      dispatch(removeUser());
      clearToken();
      clearStoredUser();
    };
  }, [dispatch]);

  if (!user && !getToken()) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <div className="w-full h-screen relative overflow-auto">
      <div className="sticky top-0 z-10">
        <Topnav user={user} />
      </div>
      <UserDetails />
      <Outlet />
    </div>
  );
};

export default Dashboard;
