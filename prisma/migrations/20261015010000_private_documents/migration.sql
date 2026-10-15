CREATE TABLE "DocumentContent" (
  "documentId" TEXT NOT NULL PRIMARY KEY,
  "data" BYTEA NOT NULL,
  CONSTRAINT "DocumentContent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "DocumentContent" ENABLE ROW LEVEL SECURITY;
