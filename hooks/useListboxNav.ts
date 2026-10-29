// Teclado para una lista de sugerencias bajo un campo de texto (patron
// «combobox con lista» de WAI-ARIA): el foco se queda en el campo y la opcion
// activa se anuncia con aria-activedescendant.
//
//   Flecha abajo / arriba  mueven la opcion activa (con vuelta al final/principio)
//   Enter                  elige la opcion activa (si no hay ninguna, no hace nada
//                          y el Enter sigue su camino, p. ej. enviar el formulario)
//   Escape                 cierra la lista
//   Tab                    cierra la lista y deja que el foco siga
//
// Uso:
//   const nav = useListboxNav({ idBase: 'x', items, open, onSelect, onClose, onOpen });
//   <input {...nav.inputProps} />
//   <ul {...nav.listProps}> {items.map((it, i) => <li {...nav.optionProps(i)} />)} </ul>

import { useCallback, useEffect, useState } from 'react';

interface Options<T> {
  /** Prefijo para los ids de la lista y de las opciones (unico en la pagina). */
  idBase: string;
  items: T[];
  open: boolean;
  onSelect: (item: T) => void;
  onClose: () => void;
  /** Flecha abajo con la lista cerrada: reabrirla si hay sugerencias. */
  onOpen?: () => void;
}

export const useListboxNav = <T,>({ idBase, items, open, onSelect, onClose, onOpen }: Options<T>) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = `${idBase}-listbox`;
  const optionId = (i: number) => `${idBase}-option-${i}`;
  const visible = open && items.length > 0;

  // Otra lista o lista cerrada: se pierde la opcion activa.
  useEffect(() => { setActiveIndex(-1); }, [items, open]);

  // La opcion activa tiene que verse dentro del desplegable con scroll.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!visible) {
        if (e.key === 'ArrowDown' && items.length > 0 && onOpen) { e.preventDefault(); onOpen(); }
        return;
      }
      e.preventDefault();
      const n = items.length;
      setActiveIndex(i => e.key === 'ArrowDown' ? (i + 1) % n : (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (visible && activeIndex >= 0 && activeIndex < items.length) {
        e.preventDefault();
        onSelect(items[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      if (visible) { e.preventDefault(); e.stopPropagation(); onClose(); }
    } else if (e.key === 'Tab') {
      if (visible) onClose();
    }
  }, [visible, items, activeIndex, onSelect, onClose, onOpen]);

  return {
    activeIndex,
    inputProps: {
      role: 'combobox' as const,
      'aria-autocomplete': 'list' as const,
      'aria-expanded': visible,
      'aria-controls': visible ? listId : undefined,
      'aria-activedescendant': visible && activeIndex >= 0 ? optionId(activeIndex) : undefined,
      onKeyDown,
    },
    listProps: { id: listId, role: 'listbox' as const },
    optionProps: (i: number) => ({
      id: optionId(i),
      role: 'option' as const,
      'aria-selected': i === activeIndex,
    }),
  };
};
