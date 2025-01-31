import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { DevicesList } from '../components/DevicesList';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await axios.get('http://localhost:3000/api/auth/me', {
          withCredentials: true,
        });
        setLoading(false);
      } catch (err) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await axios.post(
        'http://localhost:3000/api/auth/logout',
        {},
        { withCredentials: true }
      );
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome to the Dashboard</h1>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>
      <div className="dashboard-content">
        <p>
          This is a protected page. You can only see this if you're logged in.
        </p>
        <DevicesList />
      </div>
    </div>
  );
}
