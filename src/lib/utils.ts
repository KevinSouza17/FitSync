// =============================================================================
// Utilitários gerais
// -----------------------------------------------------------------------------
// Funções auxiliares usadas em todo o projeto.
// =============================================================================

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina classes CSS de forma segura, mesclando classes Tailwind conflitantes.
 * @param entradas - lista de classes (strings, arrays, objetos condicionais)
 * @returns string com as classes finais já mescladas
 */
export function cn(...entradas: ClassValue[]) {
  return twMerge(clsx(entradas));
}
