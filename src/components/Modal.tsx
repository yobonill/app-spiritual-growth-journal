import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

export default function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          {onClose && (
            <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          )}
        </header>
        {children}
      </section>
    </div>
  );
}
