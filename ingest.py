import argparse
import hashlib
from pathlib import Path
import pymupdf as fitz
from app.knowledge import ensure_index, embed


def chunks(text, size=1100, overlap=180):
    text = ' '.join(text.split())
    step = size - overlap
    return [text[i:i+size] for i in range(0, len(text), step) if len(text[i:i+size]) > 80]


def main():
    parser = argparse.ArgumentParser(description="Ingest medical PDF into Pinecone vector index.")
    parser.add_argument('--pdf', default='data/medicalpdf.pdf', help="Path to PDF file")
    parser.add_argument('--max-pages', type=int, default=None, help="Maximum number of pages to ingest")
    args = parser.parse_args()

    pdf = Path(args.pdf)
    if not pdf.exists():
        raise SystemExit(f'PDF not found: {pdf}')

    print(f'Connecting to Pinecone index...')
    index = ensure_index()
    print(f'Starting PDF processing for {pdf}...')

    with fitz.open(pdf) as doc:
        total_pages = len(doc) if args.max_pages is None else min(len(doc), args.max_pages)
        batch = []
        for page_number in range(1, total_pages + 1):
            page = doc[page_number - 1]
            page_text = page.get_text()
            for part, content in enumerate(chunks(page_text), start=1):
                key = hashlib.sha256(f'{pdf.name}:{page_number}:{part}:{content}'.encode()).hexdigest()
                batch.append((key, content, {'page': page_number, 'text': content, 'file': pdf.name}))

                if len(batch) >= 50:
                    vectors = embed([b[1] for b in batch])
                    index.upsert(vectors=[{'id': b[0], 'values': v, 'metadata': b[2]} for b, v in zip(batch, vectors)])
                    batch = []

            if page_number % 25 == 0 or page_number == total_pages:
                print(f'Indexed pages: {page_number}/{total_pages}', flush=True)

        if batch:
            vectors = embed([b[1] for b in batch])
            index.upsert(vectors=[{'id': b[0], 'values': v, 'metadata': b[2]} for b, v in zip(batch, vectors)])

    print('Ingestion complete')


if __name__ == '__main__':
    main()