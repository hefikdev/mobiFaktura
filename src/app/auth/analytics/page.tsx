"use client";

import { trpc } from "@/lib/trpc/client";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, FileText, CheckCircle, XCircle, Clock, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AnalyticsPage() {
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const { data: stats, isLoading: loadingStats } = trpc.admin.getAnalytics.useQuery();

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Unauthorized />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AdminHeader />

      <main className="flex-1 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Zaawansowana Analityka
          </h2>
          <p className="text-muted-foreground mt-1">
            Szczegółowe statystyki i wykresy systemu
          </p>
        </div>

        {loadingStats ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Wszystkie faktury</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalInvoices}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Zaakceptowane</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{stats.acceptedInvoices}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalInvoices > 0 ? ((stats.acceptedInvoices / stats.totalInvoices) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Odrzucone</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{stats.rejectedInvoices}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalInvoices > 0 ? ((stats.rejectedInvoices / stats.totalInvoices) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Oczekujące</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{stats.pendingInvoices}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalInvoices > 0 ? ((stats.pendingInvoices / stats.totalInvoices) * 100).toFixed(1) : 0}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Status Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Rozkład statusów faktur</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Zaakceptowane", value: stats.acceptedInvoices },
                        { name: "Odrzucone", value: stats.rejectedInvoices },
                        { name: "Oczekujące", value: stats.pendingInvoices },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      style={{ outline: 'none' }}
                    >
                      <Cell fill="#22c55e" />
                      <Cell fill="#ef4444" />
                      <Cell fill="#eab308" />
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--background)', 
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--foreground)'
                      }}
                      labelStyle={{ color: 'var(--foreground)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Invoices by Company */}
              <Card>
                <CardHeader>
                  <CardTitle>Faktury według firm</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.invoicesByCompany.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                      <XAxis
                        dataKey="companyName"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tick={{ fontSize: 12 }}
                        className="fill-foreground"
                      />
                      <YAxis tick={{ fontSize: 12 }} className="fill-foreground" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--card-foreground))'
                        }}
                      />
                      <Bar dataKey="count" className="fill-foreground" name="Liczba faktur" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Invoices by User */}
              <Card>
                <CardHeader>
                  <CardTitle>Aktywność użytkowników</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.invoicesByUser}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                      <XAxis
                        dataKey="userName"
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tick={{ fontSize: 12 }}
                        className="fill-foreground"
                      />
                      <YAxis tick={{ fontSize: 12 }} className="fill-foreground" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--card-foreground))'
                        }}
                      />
                      <Bar dataKey="count" className="fill-muted-foreground" name="Liczba faktur" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Accountant Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Wydajność księgowych</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={stats.accountantPerformance}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis 
                      dataKey="accountantName" 
                      tick={{ fontSize: 12 }}
                      className="fill-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="fill-foreground" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        color: 'hsl(var(--card-foreground))'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="accepted" fill="#22c55e" name="Zaakceptowane" stackId="a" />
                    <Bar dataKey="rejected" fill="#ef4444" name="Odrzucone" stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.accountantPerformance.map((accountant) => (
                    <div key={accountant.accountantId} className="border rounded p-3">
                      <p className="font-medium">{accountant.accountantName}</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          Razem: <span className="font-medium text-foreground">{accountant.totalReviewed}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Współczynnik akceptacji:{" "}
                          <span className="font-medium text-foreground">
                            {accountant.totalReviewed > 0
                              ? ((accountant.accepted / accountant.totalReviewed) * 100).toFixed(0)
                              : 0}%
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Average Processing Time */}
            <Card>
              <CardHeader>
                <CardTitle>Średni czas przetwarzania</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded">
                    <span className="text-muted-foreground">Średni czas do decyzji</span>
                    <span className="font-bold text-2xl">{stats.avgTimeToDecision} godz.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Brak danych do wyświetlenia</p>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
