import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildProjectShareText,
  canShareProjectMediaFiles,
  countProjectMedia,
  fetchProjectMediaFiles,
  getPreferredShareableFiles,
  getProjectMediaFileName,
  getProjectMediaUrls,
  getProjectSharePath,
  getProjectShareUrl,
  getShareableImageFiles,
  getWhatsAppDeepLink,
  getWhatsAppShareUrl,
  parseProjectShareIds,
  shareProjects,
} from "@/lib/projectSharing";
import type { Project, ProjectMedia } from "@/types";

function makeMedia(overrides: Partial<ProjectMedia> = {}): ProjectMedia {
  return {
    id: "media-1",
    project_id: "project-1",
    storage_path: "project-1/photo.jpg",
    media_type: "image",
    mime_type: "image/jpeg",
    file_size: 1000,
    caption: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    public_url: "https://example.com/photo.jpg",
    ...overrides,
  };
}

function stubDomShare({
  share,
  canShare,
  userAgent = "Mozilla/5.0 (Linux; Android 14)",
  writeText = vi.fn().mockResolvedValue(undefined),
}: {
  share?: ReturnType<typeof vi.fn>;
  canShare?: ReturnType<typeof vi.fn> | ((data: ShareData) => boolean);
  userAgent?: string;
  writeText?: ReturnType<typeof vi.fn>;
}) {
  const clickMock = vi.fn();
  const anchor = {
    href: "",
    target: "",
    rel: "",
    download: "",
    click: clickMock,
  };

  vi.stubGlobal("window", {
    location: { origin: "https://crm.example" },
  });
  vi.stubGlobal("document", {
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
    createElement: vi.fn(() => anchor),
  });
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal("navigator", {
    userAgent,
    share,
    canShare,
    clipboard: { writeText },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/jpeg" }),
    })
  );

  return { clickMock, anchor, writeText };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Anand Prime Residences",
    location: "Sector 62, Gurugram",
    region: "Gurugram",
    status: "under_construction",
    land_area: "12 acres",
    total_towers: "4",
    sizes: "2BHK — 1200 sq.ft.\n3BHK — 1650 sq.ft.",
    usps: "Clubhouse & pool\nMetro connectivity",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    project_media: [],
    ...overrides,
  };
}

describe("projectSharing", () => {
  it("builds a single project message with fields and optional link", () => {
    const shareUrl = "https://example.com/share/projects?ids=project-1";
    const message = buildProjectShareText({
      projects: [makeProject()],
      shareUrl,
      includeLink: true,
    });

    expect(message).toContain("Sharing details for Anand Prime Residences");
    expect(message).toContain("Location: Sector 62, Gurugram");
    expect(message).toContain("Region: Gurugram");
    expect(message).toContain("Status: Under Construction");
    expect(message).toContain("Land Area: 12 acres");
    expect(message).toContain("Total Towers: 4");
    expect(message).toContain("Sizes:");
    expect(message).toContain("2BHK — 1200 sq.ft.");
    expect(message).toContain("USPs:");
    expect(message).toContain("Clubhouse & pool");
    expect(message).toContain(`View details: ${shareUrl}`);
  });

  it("builds attachment-only text without a brochure link", () => {
    const message = buildProjectShareText({
      projects: [
        makeProject({
          project_media: [
            {
              id: "media-1",
              project_id: "project-1",
              storage_path: "project-1/photo.jpg",
              media_type: "image",
              mime_type: "image/jpeg",
              file_size: 1000,
              caption: null,
              sort_order: 0,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              public_url: "https://example.com/photo.jpg",
            },
          ],
        }),
      ],
      includeLink: false,
    });

    expect(message).not.toContain("View details:");
    expect(message).not.toContain("available in the link");
  });

  it("defaults to project fields without links or media URLs", () => {
    const message = buildProjectShareText({
      projects: [
        makeProject({
          project_media: [
            {
              id: "media-1",
              project_id: "project-1",
              storage_path: "project-1/photo.jpg",
              media_type: "image",
              mime_type: "image/jpeg",
              file_size: 1000,
              caption: null,
              sort_order: 0,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              public_url: "https://example.com/photo.jpg",
            },
          ],
        }),
      ],
      shareUrl: "https://example.com/share/projects?ids=project-1",
    });

    expect(message).not.toContain("https://example.com/photo.jpg");
    expect(message).not.toContain("View details:");
  });

  it("includes direct media URLs when requested", () => {
    const message = buildProjectShareText({
      projects: [
        makeProject({
          project_media: [
            {
              id: "media-1",
              project_id: "project-1",
              storage_path: "project-1/photo.jpg",
              media_type: "image",
              mime_type: "image/jpeg",
              file_size: 1000,
              caption: null,
              sort_order: 0,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              public_url: "https://example.com/photo.jpg",
            },
          ],
        }),
      ],
      includeMediaUrls: true,
    });

    expect(message).toContain("Photos & videos:");
    expect(message).toContain("https://example.com/photo.jpg");
  });

  it("collects media URLs across projects", () => {
    expect(
      getProjectMediaUrls([
        makeProject({
          project_media: [
            {
              id: "media-1",
              project_id: "project-1",
              storage_path: "project-1/photo.jpg",
              media_type: "image",
              mime_type: "image/jpeg",
              file_size: 1000,
              caption: null,
              sort_order: 0,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
              public_url: "https://example.com/photo.jpg",
            },
          ],
        }),
      ])
    ).toEqual(["https://example.com/photo.jpg"]);
  });

  it("builds a numbered multiple project message", () => {
    const message = buildProjectShareText({
      projects: [
        makeProject(),
        makeProject({
          id: "project-2",
          name: "Anand Prime Vista",
          location: "DLF Phase 5, Gurugram",
        }),
      ],
      shareUrl: "https://example.com/share/projects?ids=project-1%2Cproject-2",
    });

    expect(message).toContain("Sharing 2 project options");
    expect(message).toContain("1. Anand Prime Residences");
    expect(message).toContain("2. Anand Prime Vista");
  });

  it("creates encoded share paths and absolute URLs", () => {
    expect(getProjectSharePath(["a", "b"])).toBe("/share/projects?ids=a%2Cb");
    expect(getProjectShareUrl(["a", "b"], "https://crm.example")).toBe(
      "https://crm.example/share/projects?ids=a%2Cb"
    );
  });

  it("creates a WhatsApp URL with encoded message text", () => {
    const url = getWhatsAppShareUrl("Hello project buyer");

    expect(url).toBe("https://wa.me/?text=Hello%20project%20buyer");
    expect(getWhatsAppDeepLink("Hello project buyer")).toBe(
      "whatsapp://send?text=Hello%20project%20buyer"
    );
  });

  it("parses comma separated project ids", () => {
    expect(parseProjectShareIds("a, b,,c")).toEqual(["a", "b", "c"]);
    expect(parseProjectShareIds(null)).toEqual([]);
  });

  it("counts media across selected projects", () => {
    const media: ProjectMedia = {
      id: "media-1",
      project_id: "project-1",
      storage_path: "project-1/photo.jpg",
      media_type: "image",
      mime_type: "image/jpeg",
      file_size: 1000,
      caption: null,
      sort_order: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(
      countProjectMedia([
        makeProject({ project_media: [media] }),
        makeProject({ id: "project-2", project_media: [media, media] }),
      ])
    ).toBe(3);
  });

  it("builds stable media file names from storage paths", () => {
    const media: ProjectMedia = {
      id: "media-1",
      project_id: "project-1",
      storage_path: "project-1/abc-brochure.jpg",
      media_type: "image",
      mime_type: "image/jpeg",
      file_size: 1000,
      caption: null,
      sort_order: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(getProjectMediaFileName(media, "Anand Prime", 0)).toBe("abc-brochure.jpg");
  });

  it("downloads project media as File objects", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/jpeg" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const files = await fetchProjectMediaFiles([
      makeProject({
        project_media: [
          {
            id: "media-1",
            project_id: "project-1",
            storage_path: "project-1/photo.jpg",
            media_type: "image",
            mime_type: "image/jpeg",
            file_size: 1000,
            caption: null,
            sort_order: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
            public_url: "https://example.com/photo.jpg",
          },
        ],
      }),
    ]);

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("photo.jpg");
    expect(files[0].type).toBe("image/jpeg");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("detects when file sharing is unsupported", () => {
    const files = [new File(["hello"], "photo.jpg", { type: "image/jpeg" })];

    expect(canShareProjectMediaFiles(files)).toBe(false);
  });

  it("filters image files for native sharing", () => {
    const files = [
      new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      new File(["video"], "clip.mp4", { type: "video/mp4" }),
    ];

    expect(getShareableImageFiles(files)).toHaveLength(1);
    expect(getShareableImageFiles(files)[0].name).toBe("photo.jpg");
  });

  it("prefers image files when mixed media is shareable", () => {
    const files = [
      new File(["image"], "photo.jpg", { type: "image/jpeg" }),
      new File(["video"], "clip.mp4", { type: "video/mp4" }),
    ];
    vi.stubGlobal("navigator", {
      share: vi.fn(),
      canShare: vi.fn().mockReturnValue(true),
    });

    const preferred = getPreferredShareableFiles(files);
    expect(preferred).toHaveLength(1);
    expect(preferred[0].name).toBe("photo.jpg");
  });

  it("opens WhatsApp with project details only when file sharing is unavailable", async () => {
    const { clickMock, writeText } = stubDomShare({
      share: undefined,
      canShare: undefined,
      userAgent: "Mozilla/5.0",
    });

    const result = await shareProjects({
      projects: [makeProject({ project_media: [makeMedia()] })],
    });

    expect(result).toBe("whatsapp");
    expect(clickMock).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Location: Sector 62, Gurugram")
    );
  });

  it("shares files only through the native share sheet and copies details to clipboard", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    const { clickMock, writeText } = stubDomShare({
      share: shareMock,
      canShare: canShareMock,
    });

    const result = await shareProjects({
      projects: [makeProject({ project_media: [makeMedia()] })],
    });

    expect(result).toBe("whatsapp-with-photos");
    expect(shareMock).toHaveBeenCalledTimes(1);
    expect(shareMock).toHaveBeenCalledWith({
      files: [expect.objectContaining({ name: "photo.jpg", type: "image/jpeg" })],
      title: "Anand Prime Residences",
    });
    expect(shareMock.mock.calls[0][0]).not.toHaveProperty("text");
    expect(shareMock.mock.calls[0][0]).not.toHaveProperty("url");
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Location: Sector 62, Gurugram")
    );
    expect(writeText.mock.calls[0][0]).not.toContain("View details:");
    expect(writeText.mock.calls[0][0]).not.toContain("https://example.com/photo.jpg");
    expect(clickMock).not.toHaveBeenCalled();
  });

  it("falls back to WhatsApp text only when native file sharing is unsupported", async () => {
    const shareMock = vi.fn();
    const { clickMock, writeText } = stubDomShare({
      share: shareMock,
      canShare: vi.fn().mockReturnValue(false),
    });

    const result = await shareProjects({
      projects: [makeProject({ project_media: [makeMedia()] })],
    });

    expect(result).toBe("whatsapp");
    expect(shareMock).not.toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Anand Prime Residences")
    );
  });

  it("builds a WhatsApp message with project details and media links", () => {
    const message = buildProjectShareText({
      projects: [makeProject({ project_media: [makeMedia()] })],
      shareUrl: "https://crm.example/share/projects?ids=project-1",
      includeLink: true,
      includeMediaUrls: true,
    });

    expect(message).toContain("Anand Prime Residences");
    expect(message).toContain("Location: Sector 62, Gurugram");
    expect(message).toContain("https://example.com/photo.jpg");
    expect(message).toContain("View details: https://crm.example/share/projects?ids=project-1");
  });

  it("still opens WhatsApp with text only when media download fails", async () => {
    const { clickMock, anchor, writeText } = stubDomShare({
      userAgent: "Mozilla/5.0",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await shareProjects({
      projects: [makeProject({ project_media: [makeMedia()] })],
    });

    expect(result).toBe("whatsapp");
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(anchor.href).not.toContain("photo.jpg");
    expect(anchor.href).not.toContain("View%20details");
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Location: Sector 62, Gurugram")
    );
  });

  it("does not fall back to WhatsApp when the user cancels the share sheet", async () => {
    const shareMock = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const { clickMock } = stubDomShare({
      share: shareMock,
      canShare: vi.fn().mockReturnValue(true),
    });

    await expect(
      shareProjects({
        projects: [makeProject({ project_media: [makeMedia()] })],
      })
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(clickMock).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
