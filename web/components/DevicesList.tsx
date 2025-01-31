import React, { useEffect, useState } from 'react';
import _ from 'lodash';
import axios from 'axios';
import { Device } from '../types/device';
import styles from './DevicesList.module.css';

const formatUserAgent = (
  userAgent: string
): { device: string; browser: string } => {
  const ua = userAgent.toLowerCase();

  // Detect device
  let device = '💻 Desktop';
  if (ua.includes('iphone') || ua.includes('ipad')) {
    device = '📱 iOS Device';
  } else if (ua.includes('android')) {
    device = '📱 Android Device';
  } else if (ua.includes('mac')) {
    device = '🍎 Mac';
  } else if (ua.includes('linux')) {
    device = '🐧 Linux';
  } else if (ua.includes('windows')) {
    device = '🪟 Windows';
  }

  // Detect browser
  let browser = 'Unknown Browser';
  if (ua.includes('firefox')) {
    browser = '🦊 Firefox';
  } else if (ua.includes('edg')) {
    browser = '🌐 Edge';
  } else if (ua.includes('chrome')) {
    browser = '🌐 Chrome';
  } else if (ua.includes('safari')) {
    browser = '🧭 Safari';
  } else if (ua.includes('opera')) {
    browser = '🔴 Opera';
  }

  return { device, browser };
};

export const DevicesList = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      const response = await axios.get<Device[]>(
        'http://localhost:3000/api/auth/devices',
        {
          withCredentials: true,
        }
      );
      setDevices(response.data);
    } catch (err) {
      setError('Failed to load devices');
      console.error('Error fetching devices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        {_.times(3, (i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Your Devices</h2>
        <button
          className={styles.refreshButton}
          onClick={fetchDevices}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>
      {devices.length === 0 ? (
        <div>No active devices found</div>
      ) : (
        devices.map((device) => {
          const { device: deviceType, browser } = formatUserAgent(
            device.userAgent
          );
          return (
            <div key={device.id} className={styles.deviceCard}>
              <div className={styles.deviceName}>
                <span>{deviceType}</span>
                <span>{browser}</span>
              </div>
              <div className={styles.deviceInfo}>
                <div className={styles.infoItem}>
                  <span>📍</span>
                  <span>{device.ipAddress}</span>
                </div>
                <div className={styles.infoItem}>
                  <span>🕒</span>
                  <span>
                    Last active:{' '}
                    {new Date(device.lastActivityAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <span className={styles.badge}>
                  {device.activeSessions} active{' '}
                  {device.activeSessions === 1 ? 'session' : 'sessions'}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
