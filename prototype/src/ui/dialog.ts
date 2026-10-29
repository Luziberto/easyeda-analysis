/** Diálogo modal leve; delega a `window.prompt` se foi substituído (ex.: testes E2E). */
export function showPrompt(message: string, defaultValue = ''): string | null | Promise<string | null> {
  const native = typeof window !== 'undefined' ? window.prompt : null;
  if (native && native !== showPrompt) return native(message, defaultValue);

  return new Promise((resolve) => {
    const root = document.getElementById('dialog')!;
    const title = document.getElementById('dialogTitle')!;
    const input = document.getElementById('dialogInput') as HTMLInputElement;
    const ok = document.getElementById('dialogOk')!;
    const cancel = document.getElementById('dialogCancel')!;
    title.textContent = message;
    input.value = defaultValue;
    root.hidden = false;
    input.focus();
    input.select();

    const done = (v) => {
      root.hidden = true;
      ok.onclick = cancel.onclick = input.onkeydown = null;
      resolve(v);
    };
    ok.onclick = () => done(input.value);
    cancel.onclick = () => done(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); done(input.value); }
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
    };
  });
}

export function showConfirm(message: string) {
  const native = typeof window !== 'undefined' ? window.confirm : null;
  if (native) return Promise.resolve(native(message));

  return new Promise((resolve) => {
    const root = document.getElementById('dialog');
    const title = document.getElementById('dialogTitle');
    const input = document.getElementById('dialogInput');
    const ok = document.getElementById('dialogOk');
    const cancel = document.getElementById('dialogCancel');
    title.textContent = message;
    input.hidden = true;
    root.hidden = false;
    ok.textContent = 'Confirmar';
    cancel.textContent = 'Cancelar';

    const done = (v) => {
      root.hidden = true;
      input.hidden = false;
      ok.textContent = 'OK';
      cancel.textContent = 'Cancelar';
      ok.onclick = cancel.onclick = null;
      resolve(v);
    };
    ok.onclick = () => done(true);
    cancel.onclick = () => done(false);
  });
}
