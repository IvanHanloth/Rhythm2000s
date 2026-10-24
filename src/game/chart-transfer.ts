// Chart files in the browser (doc/chart-import-export.md): the file picker for importing and a download for exporting.

export interface PickedFile {
  name: string;
  text: string;
}

export interface ChartFiles {
  /**
   * Opens the browser's file picker for one .json file. Calls onFile with its name and text, or onError when it
   * can't be read; nothing happens when the player cancels. Call it from a click so the browser allows the picker.
   */
  pick(onFile: (file: PickedFile) => void, onError: (message: string) => void): void;
  /** Downloads `text` as a file named `fileName` */
  save(fileName: string, text: string): void;
}

export const browserChartFiles: ChartFiles = {
  pick(onFile, onError) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    const done = () => input.remove();
    input.addEventListener('cancel', done);
    input.addEventListener('change', () => {
      done();
      const file = input.files?.[0];
      if (!file) return;
      file.text().then(
        (text) => onFile({ name: file.name, text }),
        (error: unknown) =>
          onError(
            `the file could not be read (${error instanceof Error ? error.message : String(error)})`,
          ),
      );
    });
    document.body.append(input);
    input.click();
  },

  save(fileName, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    // Some browsers read the URL after click() returns, so give the download time to start before freeing it
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};
