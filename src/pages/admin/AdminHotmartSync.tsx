import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, FileCheck, CheckCircle2, XCircle, Loader2, AlertCircle, Download, BarChart3 } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CsvOrder {
  idVenda: string;
  email: string;
  telefone: string;
  nome: string;
  status: string;
  dataPagamento: string;
  valorPago: number;
  linha: number;
}

interface OrderMatch {
  orderId: string;
  csvOrder: CsvOrder;
  orderEmail: string;
  orderStatus: string;
  orderHotmartId?: string | null;
  hasLyrics: boolean;
}

// Função para normalizar email
function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase().replace(/[<>'"&]/g, "");
}

// Função para normalizar telefone
function normalizePhone(phone: string): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

// Função para converter valor para centavos
function convertToCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const num = parseFloat(String(value).replace(/[^\d.,]/g, "").replace(",", "."));
  return isNaN(num) ? 0 : Math.round(num * 100);
}

// Função para converter data do CSV
function convertCSVDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function parseCsvToRecords(text: string): Array<Record<string, string>> {
  const normalized = text.replace(/^\uFEFF/, '');
  const firstLine = normalized.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        const next = normalized[i + 1];
        if (next === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      field += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    if (char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [rawHeaders, ...rawDataRows] = rows.filter((r) => r.some((cell) => cell.trim().length > 0));
  if (!rawHeaders) return [];

  const headers = rawHeaders.map((h) => h.trim().replace(/^\uFEFF/, ''));
  return rawDataRows
    .map((r) => {
      const record: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        record[headers[i]] = (r[i] ?? '').trim();
      }
      return record;
    })
    .filter((rec) => Object.values(rec).some((v) => v.length > 0));
}

export default function AdminHotmartSync() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [csvOrders, setCsvOrders] = useState<CsvOrder[]>([]);
  const [matches, setMatches] = useState<OrderMatch[]>([]);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [stats, setStats] = useState({
    totalCsvOrders: 0,
    alreadyPaid: 0,
    pendingToMark: 0,
    notFound: 0,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith(".csv")) {
        toast.error("Por favor, selecione um arquivo CSV");
        return;
      }
      setFile(selectedFile);
      setCsvOrders([]);
      setMatches([]);
      setProcessedCount(0);
    }
  };

  const compareWithDatabase = useCallback(async (csvOrders: CsvOrder[]) => {
    try {
      setLoading(true);
      
      // Buscar todos os pedidos relevantes
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, customer_email, customer_whatsapp, status, hotmart_transaction_id, hotmart_payment_status")
        .in("status", ["pending", "paid"]);

      if (error) {
        throw error;
      }

      const matchesFound: OrderMatch[] = [];
      let alreadyPaidCount = 0;
      let notFoundCount = 0;

      // Verificar se pedidos têm letras geradas
      const { data: jobs } = await supabase
        .from("jobs")
        .select("order_id")
        .in("order_id", orders?.map((o) => o.id) || []);

      const ordersWithLyrics = new Set(jobs?.map((j) => j.order_id) || []);

      for (const csvOrder of csvOrders) {
        // Buscar por hotmart_transaction_id primeiro
        let matchedOrder = orders?.find(
          (o) => o.hotmart_transaction_id?.toUpperCase() === csvOrder.idVenda
        );

        // Se não encontrou, buscar por email
        if (!matchedOrder) {
          matchedOrder = orders?.find(
            (o) => normalizeEmail(o.customer_email || "") === csvOrder.email
          );
        }

        // Se ainda não encontrou, buscar por telefone
        if (!matchedOrder && csvOrder.telefone) {
          matchedOrder = orders?.find((o) => {
            const orderPhone = normalizePhone(o.customer_whatsapp || "");
            return orderPhone && orderPhone === csvOrder.telefone;
          });
        }

        if (!matchedOrder) {
          notFoundCount++;
          continue;
        }

        // Se encontrou e está pending, adicionar à lista
        if (matchedOrder.status === "pending") {
          matchesFound.push({
            orderId: matchedOrder.id,
            csvOrder,
            orderEmail: matchedOrder.customer_email || "",
            orderStatus: matchedOrder.status,
            orderHotmartId: matchedOrder.hotmart_transaction_id,
            hasLyrics: ordersWithLyrics.has(matchedOrder.id),
          });
        } else if (matchedOrder.status === "paid") {
          alreadyPaidCount++;
        }
      }

      // Atualizar estatísticas
      setStats({
        totalCsvOrders: csvOrders.length,
        alreadyPaid: alreadyPaidCount,
        pendingToMark: matchesFound.length,
        notFound: notFoundCount,
      });

      setMatches(matchesFound);
      
      if (matchesFound.length === 0) {
        toast.info("Nenhum pedido pendente encontrado que corresponda ao CSV");
      } else {
        toast.success(`${matchesFound.length} pedidos pendentes encontrados que precisam ser marcados como pago`);
      }
    } catch (error: any) {
      console.error("Erro ao comparar com banco:", error);
      toast.error(`Erro ao comparar com banco: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const parseCSV = useCallback(async () => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }

    try {
      setLoading(true);

      const text = await file.text();
      const records = parseCsvToRecords(text);

      // Processar apenas pedidos pagos
      const paidOrders: CsvOrder[] = records
        .map((record: any, index: number) => {
          const status = String(record["Status da Venda"] || record["Status"] || "").toLowerCase().trim();
          
          if (status !== "paid" && status !== "pago" && status !== "aprovado" && status !== "aprovada") {
            return null;
          }

          const email = normalizeEmail(record["Email do Cliente"] || record["Email"] || "");
          const idVenda = String(record["ID da Venda"] || "").trim();
          
          if (!email || !idVenda) {
            return null;
          }

          return {
            idVenda: idVenda.toUpperCase(),
            email,
            telefone: normalizePhone(record["Telefone do Cliente"] || ""),
            nome: String(record["Nome do Cliente"] || "").trim(),
            status: String(record["Status da Venda"] || "").trim(),
            dataPagamento: record["Data de Pagamento"] || "",
            valorPago: convertToCents(record["Valor Pago pelo Cliente"] || record["Valor"] || ""),
            linha: index + 2,
          };
        })
        .filter((order: CsvOrder | null): order is CsvOrder => order !== null);

      setCsvOrders(paidOrders);
      toast.success(`${paidOrders.length} pedidos pagos encontrados no CSV`);

      // Comparar com pedidos no banco
      await compareWithDatabase(paidOrders);
    } catch (error: any) {
      console.error("Erro ao processar CSV:", error);
      toast.error(`Erro ao processar CSV: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [file, compareWithDatabase]);

  const markAsPaidAndGenerateLyrics = useCallback(async (match: OrderMatch) => {
    try {
      setProcessingOrder(match.orderId);
      
      // 1. Marcar pedido como pago
      const paidAt = convertCSVDate(match.csvOrder.dataPagamento) || new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "paid",
          paid_at: paidAt,
          hotmart_transaction_id: match.csvOrder.idVenda,
          hotmart_payment_status: "approved",
          provider: "hotmart",
          updated_at: new Date().toISOString(),
        })
        .eq("id", match.orderId)
        .eq("status", "pending"); // Garantir que só atualiza se ainda estiver pending

      if (updateError) {
        throw updateError;
      }

      // 2. Chamar edge function como backup (o trigger também vai gerar automaticamente)
      // Verificar se pedido já tem letra antes de gerar (evitar duplicação)
      if (!match.hasLyrics) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const authToken = session?.access_token;

          const { data: functionData, error: functionError } = await supabase.functions.invoke(
            "generate-lyrics-for-approval",
            {
              body: { order_id: match.orderId },
              headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
            }
          );

          if (functionError) {
            console.warn("⚠️ Erro ao chamar generate-lyrics-for-approval (o trigger vai gerar automaticamente):", functionError);
          } else {
            console.log("✅ generate-lyrics-for-approval chamado com sucesso (backup)");
          }
        } catch (error) {
          console.warn("⚠️ Erro ao chamar generate-lyrics-for-approval (o trigger vai gerar automaticamente):", error);
        }
      } else {
        console.log("ℹ️ Pedido já tem letra, pulando geração");
      }

      // 3. Registrar no admin_logs
      await supabase.from("admin_logs").insert({
        action: "mark_order_paid_from_csv",
        details: {
          order_id: match.orderId,
          hotmart_id: match.csvOrder.idVenda,
          email: match.csvOrder.email,
          source: "hotmart_csv_sync",
        },
        user_id: (await supabase.auth.getUser()).data.user?.id,
      });

      setProcessedCount((prev) => prev + 1);
      setMatches((prev) => prev.filter((m) => m.orderId !== match.orderId));
      
      toast.success(`Pedido ${match.orderId.slice(0, 8)} marcado como pago e letra gerada`);
    } catch (error: any) {
      console.error("Erro ao marcar como pago:", error);
      toast.error(`Erro ao marcar pedido como pago: ${error.message}`);
    } finally {
      setProcessingOrder(null);
    }
  }, []);

  const markAllAsPaidAndGenerateLyrics = useCallback(async () => {
    if (matches.length === 0) {
      toast.error("Nenhum pedido para processar");
      return;
    }

    if (!confirm(`Tem certeza que deseja marcar ${matches.length} pedidos como pago e gerar letras?`)) {
      return;
    }

    try {
      setProcessing(true);
      setProcessedCount(0);
      
      // Processar em lote com delay entre requisições
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        await markAsPaidAndGenerateLyrics(match);
        
        // Delay de 1 segundo entre requisições para evitar sobrecarga
        if (i < matches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      toast.success(`${matches.length} pedidos processados com sucesso!`);
    } catch (error: any) {
      console.error("Erro ao processar em lote:", error);
      toast.error(`Erro ao processar pedidos: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }, [matches, markAsPaidAndGenerateLyrics]);

  const handleFileUpload = () => {
    if (!file) {
      toast.error("Por favor, selecione um arquivo CSV");
      return;
    }
    parseCSV();
  };

  const downloadReport = useCallback(() => {
    if (matches.length === 0) {
      toast.error("Nenhum pedido para exportar");
      return;
    }

    // Criar CSV com os pedidos identificados
    const headers = [
      "ID Pedido",
      "Email",
      "ID Hotmart",
      "Data Pagamento",
      "Valor Pago",
      "Status Atual",
      "Tem Letra",
    ];

    const rows = matches.map((match) => [
      match.orderId,
      match.csvOrder.email,
      match.csvOrder.idVenda,
      match.csvOrder.dataPagamento || "",
      (match.csvOrder.valorPago / 100).toFixed(2),
      match.orderStatus,
      match.hasLyrics ? "Sim" : "Não",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    // Criar blob e fazer download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pedidos-pendentes-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Relatório exportado com sucesso!");
  }, [matches]);

  return (
    <div className="container mx-auto p-0 space-y-2 md:space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sincronização CSV Hotmart</h1>
          <p className="text-muted-foreground mt-2">
            Faça upload de um CSV da Hotmart para identificar e marcar pedidos pagos
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload de CSV</CardTitle>
          <CardDescription>
            Selecione o arquivo CSV exportado da Hotmart com os pedidos do dia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={loading || processing}
              className="max-w-md"
            />
            <Button
              onClick={handleFileUpload}
              disabled={!file || loading || processing}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Processar CSV
                </>
              )}
            </Button>
          </div>

          {csvOrders.length > 0 && (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <FileCheck className="inline h-4 w-4 mr-2" />
                  <strong>{csvOrders.length}</strong> pedidos pagos encontrados no CSV
                </p>
              </div>
              
              {/* Estatísticas detalhadas */}
              {stats.totalCsvOrders > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Estatísticas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-700">{stats.totalCsvOrders}</p>
                        <p className="text-xs text-blue-600 mt-1">Total no CSV</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-700">{stats.alreadyPaid}</p>
                        <p className="text-xs text-green-600 mt-1">Já Pagos</p>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <p className="text-2xl font-bold text-yellow-700">{stats.pendingToMark}</p>
                        <p className="text-xs text-yellow-600 mt-1">Pendentes</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-700">{stats.notFound}</p>
                        <p className="text-xs text-gray-600 mt-1">Não Encontrados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pedidos Pendentes Encontrados</CardTitle>
                <CardDescription>
                  {matches.length} pedidos que estão como "paid" no CSV mas "pending" no sistema
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={downloadReport}
                  disabled={processing || matches.length === 0}
                  variant="outline"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
                <Button
                  onClick={markAllAsPaidAndGenerateLyrics}
                  disabled={processing || processingOrder !== null}
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Marcar Todos e Gerar Letras ({matches.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Pedido</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>ID Hotmart</TableHead>
                    <TableHead>Data Pagamento</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Letra</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.orderId}>
                      <TableCell className="font-mono text-xs">
                        {match.orderId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{match.csvOrder.email}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {match.csvOrder.idVenda}
                      </TableCell>
                      <TableCell>
                        {match.csvOrder.dataPagamento
                          ? new Date(match.csvOrder.dataPagamento).toLocaleDateString("pt-BR")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        R$ {(match.csvOrder.valorPago / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {match.hasLyrics ? (
                          <Badge variant="outline" className="bg-green-50">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Sim
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50">
                            <XCircle className="h-3 w-3 mr-1" />
                            Não
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => markAsPaidAndGenerateLyrics(match)}
                          disabled={processing || processingOrder === match.orderId}
                        >
                          {processingOrder === match.orderId ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Processando...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-3 w-3" />
                              Marcar e Gerar Letra
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {processedCount > 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <p>
                <strong>{processedCount}</strong> pedido(s) processado(s) com sucesso!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {csvOrders.length > 0 && matches.length === 0 && !loading && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-700">
              <AlertCircle className="h-5 w-5" />
              <p>
                Todos os pedidos do CSV já estão marcados como pago no sistema ou não foram encontrados.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
