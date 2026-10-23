export function researchMessage(message: string) {
  if (/"(?:code|validation)"\s*:/.test(message) && /"path"\s*:/.test(message))
    return 'Araştırma yanıtındaki bazı bilgiler veya kaynak bağlantıları okunamadı. Doğrulanmış mevcut bilgiler korundu. Güncellemeden sonra araştırmayı yeniden başlatabilirsiniz; bu yeni bir API isteğidir.';
  return message;
}
