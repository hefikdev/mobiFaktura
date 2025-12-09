"use client";

import { trpc } from "@/lib/trpc/client";
import { AdminHeader } from "@/components/admin-header";
import { Unauthorized } from "@/components/unauthorized";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorDisplay } from "@/components/error-display";
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
  const { data: stats, isLoading: loadingStats, error: statsError } = trpc.admin.getAnalytics.useQuery(
    undefined,
    {
      retry: 1,
    }
  );

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
        ) : statsError ? (
          <ErrorDisplay
            title="Wystąpił błąd podczas ładowania analityki"
            message={statsError.message}
            error={statsError}
          />
        ) : !stats ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Brak danych do wyświetlenia</p>
            </CardContent>
          </Card>
        ) : (
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {stats.accountantPerformance.map((accountant) => {
                    const acceptanceRate = accountant.totalReviewed > 0
                      ? ((accountant.accepted / accountant.totalReviewed) * 100).toFixed(1)
                      : "0";
                    const avgTime = Number(accountant.avgReviewTime).toFixed(1);
                    
                    return (
                      <div key={accountant.accountantId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-lg">{accountant.accountantName}</p>
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Razem przeglądów:</span>
                            <span className="font-medium">{accountant.totalReviewed}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Zaakceptowane:</span>
                            <span className="font-medium text-green-600">{accountant.accepted}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Odrzucone:</span>
                            <span className="font-medium text-red-600">{accountant.rejected}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Wskaźnik akceptacji:</span>
                            <span className="font-medium">{acceptanceRate}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Śr. czas przeglądu:</span>
                            <span className="font-medium">{avgTime}h</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={300}>
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
              </CardContent>
            </Card>

            {/* Monthly Summaries */}
            {stats.monthlySummaries && stats.monthlySummaries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Podsumowanie miesięczne</CardTitle>
                  <p className="text-sm text-muted-foreground">Ostatnie 6 miesięcy</p>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={stats.monthlySummaries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                      <XAxis 
                        dataKey="month_name" 
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
                      <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Wszystkie" strokeWidth={2} />
                      <Line type="monotone" dataKey="accepted" stroke="#22c55e" name="Zaakceptowane" strokeWidth={2} />
                      <Line type="monotone" dataKey="rejected" stroke="#ef4444" name="Odrzucone" strokeWidth={2} />
                      <Line type="monotone" dataKey="pending" stroke="#f59e0b" name="Oczekujące" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {stats.monthlySummaries.slice(0, 3).map((month) => (
                      <div key={month.month} className="border rounded p-3">
                        <p className="font-medium mb-2">{month.month_name}</p>
                        <div className="space-y-1 text-xs">
                          <p className="text-muted-foreground">Razem: <span className="font-medium text-foreground">{month.total}</span></p>
                          <p className="text-muted-foreground">Zaakceptowane: <span className="font-medium text-green-600">{month.accepted}</span></p>
                          <p className="text-muted-foreground">Odrzucone: <span className="font-medium text-red-600">{month.rejected}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quarterly Summaries */}
            {stats.quarterlySummaries && stats.quarterlySummaries.length > 0 && (
              <Card>
              <CardHeader>
                <CardTitle>Podsumowanie kwartalne</CardTitle>
                <p className="text-sm text-muted-foreground">Ostatnie 4 kwartały</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.quarterlySummaries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                    <XAxis 
                      dataKey="quarter" 
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
                    <Bar dataKey="total" fill="#3b82f6" name="Wszystkie" />
                    <Bar dataKey="accepted" fill="#22c55e" name="Zaakceptowane" />
                    <Bar dataKey="rejected" fill="#ef4444" name="Odrzucone" />
                    <Bar dataKey="pending" fill="#f59e0b" name="Oczekujące" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.quarterlySummaries.map((quarter) => (
                    <div key={quarter.quarter} className="border rounded p-3">
                      <p className="font-medium mb-2">{quarter.quarter}</p>
                      <div className="space-y-1 text-xs">
                        <p className="text-muted-foreground">Razem: <span className="font-medium text-foreground">{quarter.total}</span></p>
                        <p className="text-muted-foreground">Zaakceptowane: <span className="font-medium text-green-600">{quarter.accepted}</span></p>
                        <p className="text-muted-foreground">Odrzucone: <span className="font-medium text-red-600">{quarter.rejected}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )}

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
        )}
        <div className="hidden md:block">
          <Footer />
        </div>
      </main>
      <div className="md:hidden">
        <Footer />
      </div>
    </div>
  );
}
