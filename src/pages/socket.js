import { io } from "socket.io-client";

const socket = io("https://golden-horizon-soc-backend.onrender.com", {
  autoConnect: false,
});

export default socket;

