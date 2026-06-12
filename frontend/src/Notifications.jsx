import { useState } from "react";
import { ArrowLeft, Trash2, Mail, CheckCircle2, AlertCircle, Info } from "lucide-react";

export default function Notifications({ onBack }) {
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: "success",
      title: "Certificate Issued Successfully",
      message: "Your certificate for Alice Johnson has been issued and verified.",
      date: "2024-03-20T10:30:00",
      read: false,
      icon: CheckCircle2,
    },
    {
      id: 2,
      type: "info",
      title: "New Feature Available",
      message: "Bulk certificate upload is now available in your dashboard.",
      date: "2024-03-19T14:15:00",
      read: false,
      icon: Info,
    },
    {
      id: 3,
      type: "warning",
      title: "Low Credits Warning",
      message: "Your credit balance is running low. Consider purchasing more credits.",
      date: "2024-03-18T09:00:00",
      read: true,
      icon: AlertCircle,
    },
    {
      id: 4,
      type: "success",
      title: "Payment Received",
      message: "Your credit purchase of 500 credits has been confirmed.",
      date: "2024-03-15T16:45:00",
      read: true,
      icon: CheckCircle2,
    },
  ]);

  const markAsRead = (id) => {
    setNotifications(
      notifications.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const deleteNotification = (id) => {
    setNotifications(notifications.filter((notif) => notif.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(
      notifications.map((notif) => ({ ...notif, read: true }))
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getColorClasses = (type) => {
    switch (type) {
      case "success":
        return "bg-mint/10 border-mint/30 text-mint";
      case "warning":
        return "bg-amber/10 border-amber/30 text-amber";
      case "error":
        return "bg-danger/10 border-danger/30 text-danger";
      default:
        return "bg-steel/10 border-steel/30 text-steel";
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-fog dark:bg-steel font-body text-ink dark:text-fog">
      <div className="pointer-events-none absolute inset-0 gradient-bg" />
      <div className="pointer-events-none absolute -right-20 top-24 h-64 w-64 rounded-full border border-ink/15" />
      <div className="pointer-events-none absolute -left-24 bottom-12 h-72 w-72 rounded-full border border-ink/20" />

      <main className="relative mx-auto flex w-full max-w-6xl flex-col px-4 pb-12 pt-8 sm:px-8">
        {/* Header */}
        <div className="mb-8 animate-rise flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-steel hover:text-ink transition mb-4"
            >
              <ArrowLeft size={20} />
              Back to Dashboard
            </button>
            <h1 className="font-display text-3xl font-bold text-ink">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-steel/70 text-sm mt-2">
                You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="bg-mint hover:bg-mint/90 text-white font-semibold py-2.5 px-6 rounded-xl transition text-sm"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-3 animate-rise [animation-delay:100ms]">
          {notifications.length === 0 ? (
            <div className="rounded-3xl border border-steel/10 bg-white/80 p-8 shadow-soft backdrop-blur-sm text-center">
              <Mail className="mx-auto mb-4 text-steel/50" size={40} />
              <p className="text-steel/70 font-semibold">No notifications</p>
              <p className="text-steel/60 text-sm mt-1">
                You're all caught up! Check back later for updates.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const Icon = notif.icon;
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                  className={`rounded-3xl border-2 p-6 transition-all backdrop-blur-sm cursor-pointer ${
                    notif.read
                      ? "border-steel/10 bg-white/70"
                      : `${getColorClasses(notif.type)} border-current bg-white/80`
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`mt-1 p-2 rounded-lg ${getColorClasses(notif.type)} bg-opacity-20`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-ink mb-1">
                          {notif.title}
                          {!notif.read && (
                            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-mint" />
                          )}
                        </h3>
                        <p className="text-sm text-steel/70 mb-2">{notif.message}</p>
                        <p className="text-xs text-steel/50">
                          {formatDate(notif.date)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                      }}
                      className="text-steel/60 hover:text-danger transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
