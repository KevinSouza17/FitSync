import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { ClientSpreadsheets } from "../components/ClientSpreadsheets";
import { supabase } from "../lib/supabase";
import { useI18n } from "../context/I18nContext";

interface ClientInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

const initials = (name: string) =>
  name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

export function ClientSpreadsheetsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", clientId)
        .single();
      setClient(data as ClientInfo | null);
      setLoading(false);
    })();
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  const clientName = client?.full_name || t("pro.unnamedClient");

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/my-clients")}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9">
            {client?.avatar_url ? (
              <AvatarImage src={client.avatar_url} alt={clientName} />
            ) : (
              <AvatarFallback className="bg-primary-50 text-xs font-bold text-primary-600">
                {initials(clientName)}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <h1 className="text-sm font-bold text-content-strong sm:text-base">Planilhas</h1>
            <p className="text-xs text-content-muted">{clientName}</p>
          </div>
        </div>
      </div>

      {/* Full-page spreadsheet editor */}
      <div className="min-h-0 flex-1">
        {clientId ? (
          <ClientSpreadsheets clientId={clientId} clientName={clientName} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-content-muted">
            <User className="mr-2 h-5 w-5" />
            Cliente não encontrado
          </div>
        )}
      </div>
    </div>
  );
}
