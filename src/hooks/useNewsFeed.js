import { useState, useEffect, useRef, useCallback } from 'react';
import { playAlertChime } from '../utils/audio';
import { sendNotification, requestPermission } from '../utils/notifications';

const API = 'http://localhost:8000';

export function useNewsFeed(threshold = 80) {
  const [news, setNews] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [agentStats, setAgentStats] = useState({});
  const [settings, setSettings] = useState({ alert_threshold: threshold, refresh_interval: 300, max_items: 60 });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const seenAlertIds = useRef(new Set());

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [newsRes, alertsRes, agentsRes] = await Promise.all([
        fetch(`${API}/api/news`),
        fetch(`${API}/api/alerts`),
        fetch(`${API}/api/agents`),
      ]);

      if (!newsRes.ok) throw new Error(`HTTP ${newsRes.status}`);

      const newsData = await newsRes.json();
      const alertsData = await alertsRes.json();
      const agentsData = await agentsRes.json();

      setNews(newsData.items || []);
      setLastUpdated(newsData.last_updated);
      setAgentStats(agentsData);

      const incomingAlerts = alertsData.alerts || [];
      const newOnes = incomingAlerts.filter(a => !seenAlertIds.current.has(a.news_item.id));

      if (newOnes.length > 0) {
        newOnes.forEach(a => {
          seenAlertIds.current.add(a.news_item.id);
          playAlertChime();
          sendNotification(
            a.news_item.ticker || a.news_item.source,
            a.news_item.title,
            a.news_item.confidence_score,
          );
        });
      } else {
        // seed known IDs on first load so we don't re-alert stale data
        incomingAlerts.forEach(a => seenAlertIds.current.add(a.news_item.id));
      }

      setAlerts(incomingAlerts);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const manualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetch(`${API}/api/refresh`, { method: 'POST' });
      await fetchAll(true);
    } catch (err) {
      setError(err.message);
      setIsRefreshing(false);
    }
  }, [fetchAll]);

  const saveSettings = useCallback(async (newSettings) => {
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(saved);
      }
    } catch (_) {}
  }, []);

  // Initial load + request notification permission
  useEffect(() => {
    requestPermission();
    fetchAll();
  }, [fetchAll]);

  // Auto-poll every 30 seconds
  useEffect(() => {
    const id = setInterval(() => fetchAll(true), 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return {
    news, alerts, agentStats, settings, lastUpdated,
    loading, error, isRefreshing,
    manualRefresh, saveSettings,
  };
}
