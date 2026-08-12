export type FileSystem = {
  readFileSync: (path: string) => string;
  touchSync: (path: string) => void;
};
