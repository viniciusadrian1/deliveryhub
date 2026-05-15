'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '../../lib/api';
import type {
  Ingredient,
  RecipeBuilderRow,
  SubRecipeResponse,
} from '../../lib/inventory-types';
import { convertFromBase } from '../../lib/units';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { RecipeBuilder, rowsToApiPayload } from './recipe-builder';

interface SubRecipeFormDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  /** O Ingredient (kind='sub_recipe') cuja receita está sendo editada. */
  subRecipe: Ingredient | null;
}

/**
 * Editor de receita de uma sub-receita.
 *
 * Carrega a receita atual via `GET /inventory/recipes/sub-recipe/:id`,
 * deixa o usuário ajustar componentes via RecipeBuilder, e salva via PUT.
 * O backend valida anti-ciclo + recalcula custo unitário + cascateia.
 */
export function SubRecipeFormDialog({
  open,
  onClose,
  storeId,
  subRecipe,
}: SubRecipeFormDialogProps) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<RecipeBuilderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', 'ingredients', storeId],
    queryFn: () => api<Ingredient[]>(`/inventory/ingredients?storeId=${storeId}`),
    enabled: open,
  });

  const { data: current } = useQuery({
    queryKey: ['inventory', 'sub-recipe', subRecipe?.id],
    queryFn: () =>
      api<SubRecipeResponse>(`/inventory/recipes/sub-recipe/${subRecipe!.id}`),
    enabled: open && !!subRecipe,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (current) {
      setRows(
        current.components.map((c) => {
          const displayUnit = c.displayUnit ?? c.ingredient.unit;
          // quantity vem em unidade-base; converte pra display
          const qtyBase = parseFloat(c.quantity);
          const qtyDisplay =
            displayUnit !== c.ingredient.unit
              ? convertFromBase(qtyBase, c.ingredient.unit, displayUnit)
              : qtyBase;
          return {
            ingredientId: c.ingredientId,
            quantity: String(qtyDisplay),
            displayUnit,
          };
        }),
      );
    } else {
      setRows([]);
    }
  }, [open, current]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!subRecipe) throw new Error('no_sub_recipe');
      return api(`/inventory/recipes/sub-recipe/${subRecipe.id}`, {
        method: 'PUT',
        body: {
          components: rowsToApiPayload(rows, ingredients),
        },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'erro_desconhecido');
    },
  });

  if (!subRecipe) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Receita: ${subRecipe.name}`}
      description={`Rendimento: ${subRecipe.batchYield ?? '—'} por preparo.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Salvar receita
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <RecipeBuilder
          availableIngredients={ingredients.filter((i) => !i.archivedAt)}
          rows={rows}
          onChange={setRows}
          excludeIngredientId={subRecipe.id}
          batchYield={subRecipe.batchYield ?? undefined}
        />
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
            {translateError(error)}
          </div>
        )}
      </div>
    </Dialog>
  );
}

function translateError(message: string): string {
  if (message.includes('recipe_cycle_detected')) return 'Ciclo detectado: uma sub-receita não pode incluir a si mesma direta ou indiretamente.';
  if (message.includes('recipe_self_reference')) return 'Uma sub-receita não pode incluir a si mesma.';
  if (message.includes('recipe_depth_exceeded')) return 'Receita muito profunda (mais de 10 níveis aninhados).';
  if (message.includes('component_ingredient_not_found')) return 'Algum insumo selecionado não existe ou pertence a outra loja.';
  return message;
}
