import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Shield, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../components/ui/button";
import { FitSyncLogo } from "../components/FitSyncLogo";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export function TermsAcceptance() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAccept() {
    if (!acceptedTerms || !acceptedPrivacy) return;
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("accept_terms", { p_user: user.id });
      if (rpcError) throw rpcError;
      await refreshProfile();
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Erro ao aceitar os termos. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = acceptedTerms && acceptedPrivacy && !loading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-primary-50/40 px-4 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-primary-900/10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex flex-col items-center">
          <FitSyncLogo size="md" />
        </div>

        <div className="rounded-3xl border border-edge-base bg-surface-card p-6 shadow-xl sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/20">
              <Shield className="h-7 w-7 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-content-strong">Termos de Uso e Privacidade</h1>
            <p className="mt-2 text-sm text-content-muted">
              Para continuar usando o FitSync, você precisa ler e aceitar nossos Termos de Uso e nossa Política de Privacidade.
            </p>
          </div>

          {/* Terms of Use */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-edge-base">
            <button
              type="button"
              onClick={() => setShowTerms(!showTerms)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-subtle"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary-600" />
                <span className="text-sm font-semibold text-content-strong">Termos de Uso</span>
              </div>
              {showTerms ? <ChevronUp className="h-4 w-4 text-content-muted" /> : <ChevronDown className="h-4 w-4 text-content-muted" />}
            </button>
            {showTerms && (
              <div className="max-h-64 overflow-y-auto border-t border-edge-base px-5 py-4 text-sm leading-relaxed text-content-body">
                <p className="mb-3 font-semibold text-content-strong">1. Aceitação dos Termos</p>
                <p className="mb-3">Ao criar uma conta e utilizar o FitSync, você concorda com estes Termos de Uso. Se não concordar, não utilize a plataforma.</p>

                <p className="mb-3 font-semibold text-content-strong">2. Descrição do Serviço</p>
                <p className="mb-3">O FitSync é uma plataforma de saúde e bem-estar que conecta usuários a profissionais de saúde e fitness, permitindo o acompanhamento de metas, dieta, treinos e agendamento de consultas.</p>

                <p className="mb-3 font-semibold text-content-strong">3. Cadastro e Conta</p>
                <p className="mb-3">Você é responsável pela precisão das informações fornecidas no cadastro e pela manutenção da confidencialidade de sua senha. Contas profissionais (PRO) estão sujeitas a cobrança mensal de R$ 25,00 após período de teste de 7 dias.</p>

                <p className="mb-3 font-semibold text-content-strong">4. Conduta do Usuário</p>
                <p className="mb-3">Você concorda em não publicar conteúdo ofensivo, ilegal ou que viole direitos de terceiros. O FitSync reserva-se o direito de remover conteúdo e suspender contas que violem estes termos.</p>

                <p className="mb-3 font-semibold text-content-strong">5. Conteúdo Gerado pelo Usuário</p>
                <p className="mb-3">Você mantém a propriedade do conteúdo que publica, mas concede ao FitSync uma licença não exclusiva para exibi-lo na plataforma. Profissionais são responsáveis pela veracidade de suas credenciais e registros profissionais.</p>

                <p className="mb-3 font-semibold text-content-strong">6. Limitação de Responsabilidade</p>
                <p className="mb-3">O FitSync não se responsabiliza por danos decorrentes de informações de saúde compartilhadas na plataforma. As orientações de profissionais não substituem consulta médica.</p>

                <p className="mb-3 font-semibold text-content-strong">7. Cancelamento</p>
                <p className="mb-3">Você pode cancelar sua conta a qualquer momento. Assinaturas profissionais canceladas permanecem ativas até o fim do período pago.</p>

                <p className="mb-3 font-semibold text-content-strong">8. Modificações</p>
                <p className="mb-3">O FitSync pode modificar estes termos a qualquer momento. Notificaremos os usuários sobre alterações significativas.</p>
              </div>
            )}
          </div>

          {/* Privacy Policy */}
          <div className="mb-4 overflow-hidden rounded-2xl border border-edge-base">
            <button
              type="button"
              onClick={() => setShowPrivacy(!showPrivacy)}
              className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface-subtle"
            >
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary-600" />
                <span className="text-sm font-semibold text-content-strong">Política de Privacidade</span>
              </div>
              {showPrivacy ? <ChevronUp className="h-4 w-4 text-content-muted" /> : <ChevronDown className="h-4 w-4 text-content-muted" />}
            </button>
            {showPrivacy && (
              <div className="max-h-64 overflow-y-auto border-t border-edge-base px-5 py-4 text-sm leading-relaxed text-content-body">
                <p className="mb-3 font-semibold text-content-strong">1. Dados Coletados</p>
                <p className="mb-3">O FitSync coleta nome, e-mail, foto de perfil, dados de saúde (peso, altura, metas, dieta, treinos) e informações de pagamento (processadas via Stripe).</p>

                <p className="mb-3 font-semibold text-content-strong">2. Uso dos Dados</p>
                <p className="mb-3">Seus dados são utilizados para fornecer as funcionalidades da plataforma, conectar você a profissionais, enviar notificações e melhorar o serviço.</p>

                <p className="mb-3 font-semibold text-content-strong">3. Compartilhamento</p>
                <p className="mb-3">Seus dados de saúde são compartilhados apenas com profissionais que você escolher contratar. Dados de pagamento são processados pela Stripe e não armazenados pelo FitSync.</p>

                <p className="mb-3 font-semibold text-content-strong">4. Segurança</p>
                <p className="mb-3">Utilizamos criptografia e práticas de segurança para proteger seus dados. Acesso é restrito a pessoal autorizado.</p>

                <p className="mb-3 font-semibold text-content-strong">5. Seus Direitos (LGPD)</p>
                <p className="mb-3">Você pode solicitar acesso, correção ou exclusão de seus dados a qualquer momento. Para exercer seus direitos, contate-nos através da plataforma.</p>

                <p className="mb-3 font-semibold text-content-strong">6. Retenção</p>
                <p className="mb-3">Seus dados são mantidos enquanto sua conta estiver ativa. Ao excluir a conta, todos os dados são permanentemente removidos.</p>

                <p className="mb-3 font-semibold text-content-strong">7. Cookies</p>
                <p className="mb-3">Utilizamos cookies essenciais para o funcionamento da plataforma e para manter sua sessão ativa.</p>
              </div>
            )}
          </div>

          {/* Checkboxes */}
          <div className="mb-6 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge-base p-4 transition-colors hover:bg-surface-subtle">
              <button
                type="button"
                role="checkbox"
                aria-checked={acceptedTerms}
                onClick={() => setAcceptedTerms(!acceptedTerms)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  acceptedTerms ? "border-primary-600 bg-primary-600" : "border-slate-300"
                }`}
              >
                {acceptedTerms && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </button>
              <span className="text-sm text-content-body">
                Li e aceito os <strong>Termos de Uso</strong>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-edge-base p-4 transition-colors hover:bg-surface-subtle">
              <button
                type="button"
                role="checkbox"
                aria-checked={acceptedPrivacy}
                onClick={() => setAcceptedPrivacy(!acceptedPrivacy)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  acceptedPrivacy ? "border-primary-600 bg-primary-600" : "border-slate-300"
                }`}
              >
                {acceptedPrivacy && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
              </button>
              <span className="text-sm text-content-body">
                Li e aceito a <strong>Política de Privacidade</strong>
              </span>
            </label>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmit}
            onClick={handleAccept}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </span>
            ) : (
              "Aceitar e Continuar"
            )}
          </Button>

          <p className="mt-4 text-center text-xs text-content-muted">
            Você não poderá usar o FitSync sem aceitar os Termos de Uso e a Política de Privacidade.
          </p>
        </div>
      </div>
    </div>
  );
}
