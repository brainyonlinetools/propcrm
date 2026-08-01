import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildProjectShareText,
  canShareProjectMediaFiles,
  countProjectMedia,
  fetchProjectMediaFiles,
  getProjectMediaFileName,
  getProjectMediaUrls,
  getProjectSharePath,
  getProjectShareUrl,
  getShareableImageFiles,
  getWhatsAppDeepLink,
  getWhatsAppShareUrl,
  openWhatsAppWithMessage,
  parseProjectShareIds,
  shareProjects,
} from "@/lib/projectSharing";
import type { Project, ProjectMedia } from "@/types";

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

  it("opens WhatsApp with project details and photo links", async () => {
    const clickMock = vi.fn();
    const openMock = vi.fn();
    vi.stubGlobal("window", {
      open: openMock,
      location: { origin: "https://crm.example" },
    });
    vi.stubGlobal("document", {
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      createElement: vi.fn(() => ({
        href: "",
        target: "",
        rel: "",
        click: clickMock,
      })),
    });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0",
      share: undefined,
      canShare: undefined,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/jpeg" }),
    }));

    const result = await shareProjects({
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
    });

    expect(result).toBe("whatsapp");
    expect(clickMock).toHaveBeenCalledTimes(1);
  });

  it("builds a WhatsApp message with project details and media links", () => {
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
      shareUrl: "https://crm.example/share/projects?ids=project-1",
      includeLink: true,
      includeMediaUrls: true,
    });

    expect(message).toContain("Anand Prime Residences");
    expect(message).toContain("Location: Sector 62, Gurugram");
    expect(message).toContain("https://example.com/photo.jpg");
    expect(message).toContain("View details: https://crm.example/share/projects?ids=project-1");
  });

  it("still shares when media download fails", async () => {
    const clickMock = vi.fn();
    vi.stubGlobal("window", {
      location: { origin: "https://crm.example" },
    });
    vi.stubGlobal("document", {
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
      createElement: vi.fn(() => ({
        href: "",
        target: "",
        rel: "",
        click: clickMock,
      })),
    });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const result = await shareProjects({
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
    });

    expect(result).toBe("whatsapp");
    expect(clickMock).toHaveBeenCalledTimes(1);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
