// Utilitaire de debounce pour limiter la fréquence des appels
export function debounce(func, wait) {
  let timeout;
  let abortController;

  const debounced = function(...args) {
    const context = this;

    // Annuler la requête précédente si elle existe
    if (abortController) {
      abortController.abort();
    }

    // Créer un nouveau controller pour cette requête
    abortController = new AbortController();

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, [...args, abortController.signal]);
    }, wait);
  };

  debounced.cancel = function() {
    clearTimeout(timeout);
    if (abortController) {
      abortController.abort();
    }
  };

  return debounced;
}

// Version avec promesse pour async/await
export function debounceAsync(func, wait) {
  let timeout;
  let previousReject;

  return function(...args) {
    const context = this;

    return new Promise((resolve, reject) => {
      clearTimeout(timeout);
      
      // Rejeter la promesse précédente si elle existe
      if (previousReject) {
        previousReject(new Error('Cancelled by new request'));
      }
      previousReject = reject;

      timeout = setTimeout(async () => {
        try {
          previousReject = null;
          const result = await func.apply(context, args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, wait);
    });
  };
}