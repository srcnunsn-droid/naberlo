import { useState } from 'react';
import { Download, Upload } from 'lucide-react';

export function StandaloneBar({ onRestore }: { onRestore: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <section className="standalone-bar" aria-label="Tek HTML çalışma alanı">
      <div>
        <strong>Tek HTML · Kurulumsuz stüdyo</strong>
        <p>
          Projeler bu tarayıcıda saklanır. Başka cihaza geçmeden veya tarayıcı verilerini silmeden
          önce yedeğini indir.
        </p>
        {message && <p role="status">{message}</p>}
      </div>
      <div className="row">
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await (await import('../standalone')).backup();
              setMessage(
                'Yedek indirildi. Bu JSON dosyasını diğer cihazda Yedek aç ile yükleyebilirsin.',
              );
            } catch (error) {
              setMessage((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Download size={16} />
          Yedeği indir
        </button>
        <label className="button">
          <Upload size={16} />
          Yedek aç
          <input
            hidden
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setBusy(true);
              try {
                const count = await (await import('../standalone')).restore(file);
                setMessage(`${count} proje yedekten eklendi. Mevcut projeler korundu.`);
                onRestore();
              } catch {
                setMessage(
                  'Yedek açılamadı. Naberlo ile indirilen geçerli bir JSON yedeği seç; en fazla 100 MB olabilir.',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
    </section>
  );
}
