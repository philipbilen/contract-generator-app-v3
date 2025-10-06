import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page } from 'react-pdf';

interface PdfFile {
  path: string;
  refreshToken: number;
}

interface PdfViewerProps {
  file: PdfFile | null;
}

interface ScrollPosition {
  page: number;
  offset: number;
}

const DEFAULT_POSITION: ScrollPosition = { page: 1, offset: 0 };

export default function PdfViewer({ file }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pagesRendered, setPagesRendered] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollTopRef = useRef<number>(0);
  const savedPositionsRef = useRef<Map<string, ScrollPosition>>(new Map());
  const lastKnownPositionRef = useRef<ScrollPosition>(DEFAULT_POSITION);
  const pendingRestoreRef = useRef<ScrollPosition | null>(null);
  const previousFileRef = useRef<PdfFile | null>(null);

  const activeBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!file) {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }

      setPdfBlobUrl(null);
      return;
    }

    setPdfBlobUrl(null);
    setNumPages(null);
    setPagesRendered(0);

    // eslint-disable-next-line no-console
    console.log(`Requesting PDF data for path: ${file.path}`);
    window.electron.ipcRenderer
      .invoke('get-pdf-data', file.path)
      .then((data: Uint8Array | null) => {
        if (!data) {
          setPdfBlobUrl(null);
          return null;
        }

        const normalizeToUint8Array = () => {
          if (data instanceof Uint8Array) {
            return Uint8Array.from(data);
          }
          if (Array.isArray(data)) {
            return Uint8Array.from(data);
          }
          if (
            data &&
            typeof (data as ArrayBufferLike).byteLength === 'number'
          ) {
            return new Uint8Array(data as ArrayBufferLike);
          }

          return Uint8Array.from([]);
        };

        const array = normalizeToUint8Array();
        const bufferLike = array.buffer as ArrayBufferLike & {
          slice?: (begin: number, end: number) => ArrayBuffer;
        };
        let arrayBuffer: ArrayBuffer;
        if (typeof bufferLike.slice === 'function') {
          arrayBuffer = bufferLike.slice(
            array.byteOffset,
            array.byteOffset + array.byteLength,
          ) as ArrayBuffer;
        } else {
          const clone = new Uint8Array(array);
          arrayBuffer = clone.buffer as ArrayBuffer;
        }

        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        const nextUrl = URL.createObjectURL(blob);

        if (activeBlobUrlRef.current) {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        }

        activeBlobUrlRef.current = nextUrl;
        setPdfBlobUrl(nextUrl);
        return null;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Error fetching PDF data:', err);
        setPdfBlobUrl(null);
      });
  }, [file]);

  useEffect(
    () => () => {
      if (activeBlobUrlRef.current) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
        activeBlobUrlRef.current = null;
      }
    },
    [],
  );

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: nextNumPages }: { numPages: number }) => {
      setNumPages(nextNumPages);
      setPagesRendered(0);
      pageRefs.current = new Array(nextNumPages).fill(null);
    },
    [],
  );

  const handlePageRenderSuccess = useCallback(() => {
    setPagesRendered((prev) => prev + 1);
  }, []);

  const registerPageRef = useCallback(
    (pageIndex: number) => (node: HTMLDivElement | null) => {
      pageRefs.current[pageIndex] = node;
      if (node) {
        node.dataset.pageNumber = String(pageIndex + 1);
      }
    },
    [],
  );

  const handleVisiblePageChange = useCallback(
    (
      pageNumber: number,
      container: HTMLDivElement,
      pageElement: HTMLDivElement,
    ) => {
      const offsetWithinPage = Math.max(
        0,
        container.scrollTop - pageElement.offsetTop,
      );
      const updatedPosition: ScrollPosition = {
        page: pageNumber,
        offset: offsetWithinPage,
      };
      lastKnownPositionRef.current = updatedPosition;

      if (file?.path) {
        savedPositionsRef.current.set(file.path, updatedPosition);
      }
    },
    [file?.path],
  );

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    scrollTopRef.current = container.scrollTop;

    const { page } = lastKnownPositionRef.current;
    const pageElement = pageRefs.current[page - 1];
    if (pageElement && file?.path) {
      const offsetWithinPage = Math.max(
        0,
        container.scrollTop - pageElement.offsetTop,
      );
      const updatedPosition: ScrollPosition = {
        page,
        offset: offsetWithinPage,
      };
      lastKnownPositionRef.current = updatedPosition;
      savedPositionsRef.current.set(file.path, updatedPosition);
    }
  }, [file?.path]);

  useEffect(() => {
    if (!file) {
      setNumPages(null);
      setPagesRendered(0);
      lastKnownPositionRef.current = { ...DEFAULT_POSITION };
      scrollTopRef.current = 0;
      previousFileRef.current = null;
      pendingRestoreRef.current = null;
      return;
    }

    const previous = previousFileRef.current;
    const isFirstLoad = !previous;
    const pathChanged = previous?.path !== file.path;
    const refreshChanged = previous?.refreshToken !== file.refreshToken;

    if (isFirstLoad || pathChanged || refreshChanged) {
      const savedPosition = savedPositionsRef.current.get(file.path);
      pendingRestoreRef.current = savedPosition
        ? { ...savedPosition }
        : { ...DEFAULT_POSITION };
    }

    previousFileRef.current = file;
  }, [file]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    container.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !file || !numPages) {
      return;
    }

    const pendingPosition = pendingRestoreRef.current;
    if (!pendingPosition || pagesRendered < numPages) {
      return;
    }

    const targetPageIndex =
      Math.min(Math.max(pendingPosition.page, 1), numPages) - 1;
    const pageElement = pageRefs.current[targetPageIndex];
    if (!pageElement) {
      return;
    }

    const pageHeight = pageElement.offsetHeight || 0;
    const maxOffset = Math.max(0, pageHeight - container.clientHeight);
    const clampedOffset = Math.max(
      0,
      Math.min(pendingPosition.offset, maxOffset),
    );
    const targetScrollTop = pageElement.offsetTop + clampedOffset;

    requestAnimationFrame(() => {
      container.scrollTo({ top: targetScrollTop });
    });

    scrollTopRef.current = targetScrollTop;
    const updatedPosition: ScrollPosition = {
      page: targetPageIndex + 1,
      offset: clampedOffset,
    };
    lastKnownPositionRef.current = updatedPosition;
    savedPositionsRef.current.set(file.path, updatedPosition);
    pendingRestoreRef.current = null;
  }, [file, numPages, pagesRendered]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !numPages || pagesRendered === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(
            (entry) => entry.isIntersecting && entry.intersectionRatio > 0,
          )
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length === 0) {
          return;
        }

        const [topEntry] = visible;
        const pageNumber = Number(
          topEntry.target.getAttribute('data-page-number'),
        );
        if (!Number.isFinite(pageNumber) || pageNumber < 1) {
          return;
        }

        handleVisiblePageChange(
          pageNumber,
          container,
          topEntry.target as HTMLDivElement,
        );
      },
      {
        root: container,
        threshold: [0.1, 0.25, 0.5, 0.75, 0.9],
      },
    );

    pageRefs.current.slice(0, numPages).forEach((pageRef) => {
      if (pageRef) {
        observer.observe(pageRef);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [numPages, pagesRendered, handleVisiblePageChange]);

  if (!file) {
    return (
      <div className="preview-placeholder">
        <p>Generate an agreement to see the PDF preview.</p>
      </div>
    );
  }

  if (!pdfBlobUrl) {
    return <div className="preview-placeholder">Loading PDF...</div>;
  }

  return (
    <div className="pdf-viewer-container" ref={containerRef}>
      <Document
        key={`${file.path}-${file.refreshToken}-${pdfBlobUrl}`}
        file={pdfBlobUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={(error) => {
          // eslint-disable-next-line no-console
          console.error('Failed to load PDF:', error);
        }}
        loading={<div className="preview-placeholder">Loading PDF...</div>}
        error={<div className="preview-placeholder">Failed to load PDF.</div>}
      >
        {Array.from({ length: numPages ?? 0 }, (_, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={containerRef.current?.clientWidth}
            renderAnnotationLayer
            onRenderSuccess={handlePageRenderSuccess}
            inputRef={registerPageRef(index)}
          />
        ))}
      </Document>
    </div>
  );
}
