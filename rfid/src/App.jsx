import { Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import RfidTapPage from './features/rfid/RfidTapPage';

function App() {
    return (
        <>
            <ToastContainer position="top-right" autoClose={3000} />
            <Routes>
                <Route path="/*" element={<RfidTapPage />} />
            </Routes>
        </>
    );
}

export default App;