/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import exifr from "exifr";
import {
  Image as ImageIcon,
  Camera,
  Compass,
  Building2,
  Trees,
  Plus,
  Heart,
  Search,
  Trash2,
  Play,
  Pause,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  MapPin,
  Info,
  SlidersHorizontal,
  UploadCloud,
  X,
  Check,
  Edit2,
  BookOpen,
  Tag,
  Eye,
  Loader,
  Cloud,
  Link,
  LogOut,
  Trash,
  Bookmark,
  ArrowDown,
  ArrowUp,
  LayoutGrid,
  Share2,
  CheckSquare,
  Square,
  Download,
  Maximize,
  Folder,
  ZoomIn,
  ZoomOut,
  Crop,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Photo, Album, DeviceType } from "../types";
import { INITIAL_PHOTOS, INITIAL_ALBUMS, FILTER_PRESETS } from "../data";
import { initAuth, googleSignIn, logout, getCachedAccessToken } from "../lib/firebaseAuth";
import { savePhotosToDB, getPhotosFromDB } from "../lib/db";
import { User } from "firebase/auth";
import Cropper from "react-easy-crop";

interface GalleryAppProps {
  setIsFloatingUploadOpen?: (open: boolean) => void;
}

export default function GalleryApp({ setIsFloatingUploadOpen }: GalleryAppProps = {}) {
  // Persistence state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(true);

  // Load photos from IndexedDB on mount
  useEffect(() => {
    const loadPhotos = async () => {
      try {
        const dbPhotos = await getPhotosFromDB();
        setPhotos(dbPhotos || []);
      } catch (err) {
        console.error("Failed to load photos from DB:", err);
      } finally {
        setIsDbLoading(false);
      }
    };
    loadPhotos();
  }, []);

  const [albums, setAlbums] = useState<Album[]>(() => {
    const saved = localStorage.getItem("android_gallery_albums");
    return saved ? JSON.parse(saved) : INITIAL_ALBUMS;
  });

  useEffect(() => {
    localStorage.setItem("android_gallery_albums", JSON.stringify(albums));
  }, [albums]);

  const [activeTab, setActiveTab] = useState<"photos" | "albums" | "add" | "magic" | "settings">("photos");
  const [selectedAlbum, setSelectedAlbum] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [themeName, setThemeName] = useState<string>(() => {
    const saved = localStorage.getItem("android_gallery_theme");
    return saved || "default";
  });
  
  useEffect(() => {
    localStorage.setItem("android_gallery_theme", themeName);
    
    let fgColor = "#000000";
    if (themeName.startsWith("#")) {
       const hex = themeName.replace("#", "");
       const r = parseInt(hex.substr(0, 2), 16) || 0;
       const g = parseInt(hex.substr(2, 2), 16) || 0;
       const b = parseInt(hex.substr(4, 2), 16) || 0;
       const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
       fgColor = (yiq >= 128) ? "#000000" : "#ffffff";
       document.documentElement.style.setProperty("--theme-accent", themeName);
       document.documentElement.style.setProperty("--theme-accent-fg", fgColor);
       document.documentElement.className = "theme-custom";
    } else {
       document.documentElement.style.removeProperty("--theme-accent");
       document.documentElement.style.removeProperty("--theme-accent-fg");
       document.documentElement.className = themeName === "default" ? "" : `theme-${themeName}`;
    }
  }, [themeName]);
  const [currentLightboxIndex, setCurrentLightboxIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<number>(0);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Cropper state
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [cropAspect, setCropAspect] = useState<number | undefined>(4 / 3);
  
  // Slideshow state
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState<boolean>(false);
  const [activeFilterTab, setActiveFilterTab] = useState<"all" | "favorites">("all");
  
  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [bulkActionTargetAlbum, setBulkActionTargetAlbum] = useState<string>("favorites");
  const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [gridColumns, setGridColumns] = useState<2 | 3 | 4>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? 2 : 4;
    }
    return 4;
  });
  
  // Custom upload fields
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAlbum, setUploadAlbum] = useState("camera");
  const [uploadLocation, setUploadLocation] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadImageFile, setUploadImageFile] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // AI Summary State
  const [gallerySummary, setGallerySummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);

  // Google Drive & Authentication state
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [addPhotoSource, setAddPhotoSource] = useState<"local" | "drive">("local");
  const [driveUrl, setDriveUrl] = useState("");
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [syncFolderId, setSyncFolderId] = useState<string>(() => localStorage.getItem("android_gallery_sync_folder") || "");
  const [syncTargetAlbum, setSyncTargetAlbum] = useState<string>("all");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [uploadSize, setUploadSize] = useState("1.5 MB");
  const [isBackgroundAnalyzing, setIsBackgroundAnalyzing] = useState(false);

  // Background Auto-Analyzer
  useEffect(() => {
    const unanalyzedPhoto = photos.find(p => !p.aiGenerated && !p.isAnalyzed);
    if (unanalyzedPhoto && !isBackgroundAnalyzing) {
      const runBgAnalysis = async () => {
        setIsBackgroundAnalyzing(true);
        try {
          const res = await fetch("/api/gemini/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: unanalyzedPhoto.url.startsWith("data:") ? unanalyzedPhoto.url : undefined,
              mimeType: unanalyzedPhoto.url.startsWith("data:") ? unanalyzedPhoto.url.substring(5, unanalyzedPhoto.url.indexOf(";")) : undefined,
              requestType: "auto_analyze",
            }),
          });
          const data = await res.json();
          if (res.ok && data.status === "success") {
            const newDesc = data.description || unanalyzedPhoto.description;
            const newTags = data.suggestedTags || [];
            const albumName = data.suggestedAlbum || "";
            
            let assignedAlbumId = unanalyzedPhoto.album;
            if (albumName && assignedAlbumId === "all") {
              const cleanedName = albumName.substring(0, 20).trim();
              const existingAlbum = albums.find(a => a.name.toLowerCase() === cleanedName.toLowerCase());
              if (existingAlbum) {
                 assignedAlbumId = existingAlbum.id;
              } else {
                 const newId = cleanedName.toLowerCase().replace(/\s+/g, '_');
                 assignedAlbumId = newId;
                 setAlbums(prev => {
                   if (!prev.find(a => a.id === newId)) {
                     return [...prev, { id: newId, name: cleanedName, iconName: "Folder" }];
                   }
                   return prev;
                 });
              }
            }
            
            setPhotos(prev => prev.map(p => {
              if (p.id === unanalyzedPhoto.id) {
                const combinedTags = Array.from(new Set([...p.tags, ...newTags.map((t: string) => t.toLowerCase())]));
                return { ...p, isAnalyzed: true, description: newDesc, tags: combinedTags, album: assignedAlbumId };
              }
              return p;
            }));
          } else {
             setPhotos(prev => prev.map(p => p.id === unanalyzedPhoto.id ? { ...p, isAnalyzed: true } : p));
          }
        } catch (err) {
          setPhotos(prev => prev.map(p => p.id === unanalyzedPhoto.id ? { ...p, isAnalyzed: true } : p));
        } finally {
          setIsBackgroundAnalyzing(false);
        }
      };
      runBgAnalysis();
    }
  }, [photos, isBackgroundAnalyzing, albums]);

  useEffect(() => {
    localStorage.setItem("android_gallery_sync_folder", syncFolderId);
  }, [syncFolderId]);

  // Listen to Google Authentication state
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setDriveUser(user);
        setDriveError(null);
      },
      () => {
        setDriveUser(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setDriveError(null);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        setDriveUser(res.user);
      }
    } catch (err: any) {
      console.error(err);
      setDriveError(err.message || "Sign in failed");
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logout();
      setDriveUser(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Extract file ID from google drive links
  const extractDriveFileId = (url: string): string => {
    if (!url) return "";
    const cleanUrl = url.trim();
    if (/^[a-zA-Z0-9_-]{28,50}$/.test(cleanUrl)) {
      return cleanUrl;
    }
    const matchD = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) return matchD[1];

    const matchId = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (matchId && matchId[1]) return matchId[1];

    return "";
  };

  const handleFetchGoogleDriveFile = async () => {
    if (!driveUrl) {
      setDriveError("Please enter a Google Drive link or File ID.");
      return;
    }
    setDriveError(null);
    setIsFetchingDrive(true);

    try {
      const fileId = extractDriveFileId(driveUrl);
      if (!fileId) {
        throw new Error("Could not parse a valid Google Drive File ID. Ensure format matches drive.google.com/file/d/FILE_ID/...");
      }

      const token = getCachedAccessToken();
      if (!token) {
        throw new Error("Authentication token is missing. Please sign in with Google again.");
      }

      // Step 1: Fetch metadata
      const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!metaRes.ok) {
        const errJson = await metaRes.json().catch(() => ({}));
        throw new Error(errJson.error?.message || "Google Drive file access denied. Make sure the file is shared or shared with anyone on the web.");
      }

      const meta = await metaRes.json();
      if (!meta.mimeType.startsWith("image/")) {
        throw new Error(`The selected file is not an image (Type: ${meta.mimeType}). Please point to an image.`);
      }

      // Step 2: Fetch media content
      const mediaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!mediaRes.ok) {
        throw new Error("Failed to download image contents from Google Drive.");
      }

      const blob = await mediaRes.blob();
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setUploadImageFile(reader.result as string);
          
          // Prepopulate fields from drive metadata
          const cleanName = meta.name.split(".")[0].replace(/[-_]/g, " ");
          setUploadTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
          
          // Calculate human-readable size
          let finalSize = "1.5 MB";
          if (meta.size) {
            const bytes = parseInt(meta.size);
            if (bytes > 1024 * 1024) {
              finalSize = (bytes / (1024 * 1024)).toFixed(1) + " MB";
            } else {
              finalSize = (bytes / 1024).toFixed(0) + " KB";
            }
          } else if (blob.size) {
            if (blob.size > 1024 * 1024) {
              finalSize = (blob.size / (1024 * 1024)).toFixed(1) + " MB";
            } else {
              finalSize = (blob.size / 1024).toFixed(0) + " KB";
            }
          }
          setUploadSize(finalSize);
          setUploadLocation("Google Drive");
        }
      };
      reader.readAsDataURL(blob);

    } catch (err: any) {
      console.error(err);
      setDriveError(err.message || "An error occurred while fetching from Google Drive.");
    } finally {
      setIsFetchingDrive(false);
    }
  };

  const handleSyncToDrive = async (albumId: string = "all") => {
    if (!driveUser || !getCachedAccessToken()) {
      alert("Please connect Google Drive in the Add Photo tab or wait for authentication.");
      return;
    }
    
    // Find unsynced
    const unsyncedPhotos = photos.filter(p => !p.isSyncedToDrive && (albumId === "all" || p.album === albumId));
    if (unsyncedPhotos.length === 0) {
      alert(albumId === "all" ? "All photos are already synced to Drive." : "All photos in this album are synced.");
      return;
    }
    
    setIsSyncing(true);
    let successCount = 0;
    
    const token = getCachedAccessToken();
    try {
      for (const photo of unsyncedPhotos) {
        let blob;
        if (photo.url.startsWith("data:")) {
          const res = await fetch(photo.url);
          blob = await res.blob();
        } else {
          // It's possibly an external URL that might fail cors, or blob URL
          const res = await fetch(photo.url);
          blob = await res.blob();
        }
        
        const metadata = {
          name: `${photo.title}.jpg`,
          description: photo.description || "",
          parents: syncFolderId ? [syncFolderId] : undefined
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);
        
        const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: form
        });
        
        if (!uploadRes.ok) throw new Error("Upload to Google Drive failed");
        
        const fileData = await uploadRes.json();
        
        setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, isSyncedToDrive: true, driveFileId: fileData.id } : p));
        successCount++;
      }
      alert(`Successfully synced ${successCount} photos to Drive.`);
    } catch (e: any) {
      console.error(e);
      alert("Sync failed: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Editing state for metadata & filters
  const [isEditingMeta, setIsEditingMeta] = useState<boolean>(false);
  const [lightboxTab, setLightboxTab] = useState<"details" | "exif">("details");
  const [exifData, setExifData] = useState<Record<string, string> | null>(null);
  const [isParsingExif, setIsParsingExif] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editTags, setEditTags] = useState("");

  // AI Interaction state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    description: string;
    suggestedTags: string[];
    palette?: string[];
    story?: string;
  } | null>(null);
  const [aiStoryLoading, setAiStoryLoading] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Save to IndexedDB database whenever state changes
  useEffect(() => {
    if (isDbLoading) return;
    savePhotosToDB(photos).catch((e) => {
      console.error("Failed to save photos to IndexedDB:", e);
    });
  }, [photos, isDbLoading]);

  // Ref for long press
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = (photoId: string) => {
    if (isSelectionMode) return;
    longPressTimerRef.current = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedPhotos(new Set([photoId]));
    }, 500); // 500ms long press
  };

  const handlePointerUpOrLeave = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Bulk selection functions
  const togglePhotoSelection = (id: string) => {
    const next = new Set(selectedPhotos);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedPhotos(next);
  };

  const handleBulkDownload = async () => {
    if (selectedPhotos.size === 0) return;
    try {
      const selectedPhotoObjects = Array.from(selectedPhotos).map(id => photos.find(p => p.id === id)).filter(Boolean) as Photo[];
      
      for (const photo of selectedPhotoObjects) {
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${photo.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);
          
          // small delay to prevent browser crash from downloading multiple files rapidly
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (e) {
          console.error("Could not download", photo.url, e);
        }
      }
      setSelectedPhotos(new Set());
      setIsSelectionMode(false);
    } catch (err) {
      console.error("Error with bulk download:", err);
    }
  };

  const handleBulkShare = async () => {
    if (selectedPhotos.size === 0) return;
    
    try {
      const selectedPhotoObjects = Array.from(selectedPhotos).map(id => photos.find(p => p.id === id)).filter(Boolean) as Photo[];
      const urls = selectedPhotoObjects.map(p => p.url);

      const filesToShare: File[] = [];
      for (const photo of selectedPhotoObjects) {
        try {
          const response = await fetch(photo.url);
          const blob = await response.blob();
          const file = new File([blob], `${photo.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`, { type: blob.type || 'image/jpeg' });
          filesToShare.push(file);
        } catch (e) {
          console.warn("Could not handle fetching blob for", photo.url);
        }
      }

      if (navigator.share) {
        const shareData: ShareData = {
          title: `Sharing ${selectedPhotos.size} photos`,
          text: `Check out these ${selectedPhotos.size} photos!`
        };

        if (filesToShare.length > 0 && navigator.canShare && navigator.canShare({ files: filesToShare })) {
          shareData.files = filesToShare;
        } else {
          shareData.text += `\n${urls.join("\n")}`;
        }
        
        await navigator.share(shareData);
      } else {
        navigator.clipboard.writeText(urls.join("\n"));
        window.alert("Links copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const handleBulkDelete = () => {
    if (selectedPhotos.size === 0) return;
    if (!confirm(`Delete ${selectedPhotos.size} selected items?`)) return;
    setPhotos(prev => prev.filter(p => !selectedPhotos.has(p.id)));
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkMove = () => {
    if (selectedPhotos.size === 0) return;
    setPhotos(prev => prev.map(p => 
      selectedPhotos.has(p.id) ? { ...p, album: bulkActionTargetAlbum } : p
    ));
    setIsBulkMoveModalOpen(false);
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };


  // Slideshow automatic player
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSlideshowPlaying && currentLightboxIndex !== null) {
      timer = setInterval(() => {
        handleNextLightbox(false);
      }, 3000);
    }
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSlideshowPlaying, currentLightboxIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentLightboxIndex === null) return;
      if (e.key === "Escape") handleCloseLightbox();
      if (e.key === "ArrowLeft") handlePrevLightbox(true);
      if (e.key === "ArrowRight") handleNextLightbox(true);
      if (e.key === " ") {
        e.preventDefault();
        setIsSlideshowPlaying((prev: boolean) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Filter photos based on search query, active album, and tags
  const filteredPhotos = useMemo(() => {
    return photos.filter((photo) => {
      const matchesAlbum = selectedAlbum === "all" || photo.album === selectedAlbum;
      const matchesFilter = activeFilterTab === "all" || (activeFilterTab === "favorites" && photo.favorite);
      const lowercaseSearch = searchQuery.toLowerCase();
      
      const matchesSearch = 
        searchQuery === "" ||
        photo.title.toLowerCase().includes(lowercaseSearch) ||
        photo.location.toLowerCase().includes(lowercaseSearch) ||
        (photo.description && photo.description.toLowerCase().includes(lowercaseSearch)) ||
        photo.tags.some(tag => tag.toLowerCase().includes(lowercaseSearch));

      return matchesAlbum && matchesFilter && matchesSearch;
    }).sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
  }, [photos, selectedAlbum, activeFilterTab, searchQuery, sortOrder]);

  const handleSelectAllToggle = () => {
    const allFilteredIds = filteredPhotos.map(p => p.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedPhotos.has(id));
    if (isAllSelected) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(allFilteredIds));
    }
  };

  const isAllSelected = useMemo(() => {
    return filteredPhotos.length > 0 && filteredPhotos.every(p => selectedPhotos.has(p.id));
  }, [filteredPhotos, selectedPhotos]);

  // Toggle favorite trigger
  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPhotos(prev =>
      prev.map(p => (p.id === id ? { ...p, favorite: !p.favorite } : p))
    );
  };

  const handleGenerateGallerySummary = async () => {
    try {
      setIsGeneratingSummary(true);
      setGallerySummary(null);

      const galleryData = photos.map(p => ({
        title: p.title,
        tags: p.tags,
        location: p.location,
        album: p.album
      }));

      const res = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: "gallery-summary",
          galleryData: galleryData.slice(0, 50) // limit to avoid massive payloads
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate summary.");
      setGallerySummary(data.story || data.description || "Could not generate summary.");
    } catch (err: any) {
      console.error(err);
      setGallerySummary("Error: " + err.message);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Exif parser
  useEffect(() => {
    let isMounted = true;
    
    if (currentLightboxIndex !== null && filteredPhotos[currentLightboxIndex]) {
      const url = filteredPhotos[currentLightboxIndex].url;
      setIsParsingExif(true);
      setExifData({});
      
      // Try to parse using browser fetch & exifr
      // if it's a blob URL that is locally hosted, or an external one that has CORS enabled
      fetch(url)
        .then(res => res.blob())
        .then(blob => exifr.parse(blob))
        .then(data => {
          if (isMounted) {
            setExifData(data || {});
            setIsParsingExif(false);
          }
        })
        .catch(err => {
          console.warn("Could not parse EXIF data", err);
          if (isMounted) {
            setExifData({ error: "Could not read EXIF data relative to constraints." });
            setIsParsingExif(false);
          }
        });
    } else {
      setExifData(null);
    }
    
    return () => { isMounted = false; };
  }, [currentLightboxIndex, filteredPhotos]);

  // Lightbox index pointers
  const handleZoomIn = () => setLightboxZoom(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setLightboxZoom(prev => Math.max(prev - 0.5, 0.5));

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageSrc;
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL("image/jpeg");
  };

  const handleSaveCrop = async () => {
    if (currentLightboxIndex === null || !croppedAreaPixels) return;
    try {
      const currentPhoto = filteredPhotos[currentLightboxIndex];
      const croppedImage = await getCroppedImg(currentPhoto.url, croppedAreaPixels);
      
      const newPhotoId = "cropped_" + Date.now();
      const updatedPhoto = { ...currentPhoto, id: newPhotoId, url: croppedImage, originalUrl: croppedImage };
      
      setPhotos(prev => prev.map(p => p.id === currentPhoto.id ? updatedPhoto : p));
      setIsCropping(false);
    } catch (e) {
      console.error(e);
      alert("Failed to crop image.");
    }
  };

  const handleSaveFilter = (photo: Photo) => {
    const newPhoto = { 
      ...photo, 
      id: "filtered_" + Date.now(), 
      title: photo.title + " (Edited)",
      date: new Date().toISOString().split("T")[0]
    };
    setPhotos(prev => [newPhoto, ...prev]);
    alert("Saved as a new image in your gallery!");
  };

  const handleStartSlideshow = () => {
    if (filteredPhotos.length === 0) return;
    setCurrentLightboxIndex(0);
    setLightboxTab("details");
    setIsSlideshowPlaying(true);
    setAiAnalysis(null);
    setAiError(null);
    setIsEditingMeta(false);
    setLightboxZoom(1);
    
    // Automatically trigger AI analysis natively for the first image
    if (filteredPhotos[0] && !filteredPhotos[0].aiGenerated) {
       triggerGeminidAnalysis(filteredPhotos[0]);
    }
  };

  const handleOpenLightbox = (index: number) => {
    setCurrentLightboxIndex(index);
    setLightboxTab("details");
    setIsSlideshowPlaying(false);
    setAiAnalysis(null);
    setAiError(null);
    setIsEditingMeta(false);
    setLightboxZoom(1);
    
    // Set initial edit state
    const target = filteredPhotos[index];
    if (target) {
      setEditTitle(target.title);
      setEditLocation(target.location);
      setEditTags(target.tags.join(", "));
    }
  };

  const handleCloseLightbox = () => {
    setCurrentLightboxIndex(null);
    setIsSlideshowPlaying(false);
    setLightboxZoom(1);
  };

  const handlePrevLightbox = (isManual = true) => {
    if (currentLightboxIndex === null) return;
    if (isManual) setIsSlideshowPlaying(false);
    setAiAnalysis(null);
    setAiError(null);
    setIsEditingMeta(false);
    setLightboxZoom(1);
    const newIdx = currentLightboxIndex === 0 ? filteredPhotos.length - 1 : currentLightboxIndex - 1;
    setSlideDirection(-1);
    setCurrentLightboxIndex(newIdx);

    const target = filteredPhotos[newIdx];
    if (target) {
      setEditTitle(target.title);
      setEditLocation(target.location);
      setEditTags(target.tags.join(", "));
    }
  };

  const handleNextLightbox = (isManual = true) => {
    if (currentLightboxIndex === null) return;
    if (isManual) setIsSlideshowPlaying(false);
    setAiAnalysis(null);
    setAiError(null);
    setIsEditingMeta(false);
    setLightboxZoom(1);
    const newIdx = currentLightboxIndex === filteredPhotos.length - 1 ? 0 : currentLightboxIndex + 1;
    setSlideDirection(1);
    setCurrentLightboxIndex(newIdx);

    const target = filteredPhotos[newIdx];
    if (target) {
      setEditTitle(target.title);
      setEditLocation(target.location);
      setEditTags(target.tags.join(", "));
    }
  };

  const handleDownloadPhoto = async (photo: Photo) => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${photo.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
      window.alert("Failed to download image.");
    }
  };

  const handleSharePhoto = async (photo: Photo) => {
    try {
      let fileToShare: File | null = null;
      
      try {
        const response = await fetch(photo.url);
        const blob = await response.blob();
        fileToShare = new File([blob], `${photo.title.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`, { type: blob.type || 'image/jpeg' });
      } catch (e) {
        console.warn("Could not fetch image to create shareable File", e);
      }

      if (navigator.share) {
        const shareData: ShareData = {
          title: photo.title,
          text: `Check out this photo: ${photo.title} from ${photo.location}`
        };

        if (fileToShare && navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
          shareData.files = [fileToShare];
        } else {
          shareData.url = photo.url;
        }

        await navigator.share(shareData);
      } else {
        navigator.clipboard.writeText(photo.url);
        window.alert("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Error sharing:", err);
    }
  };

  const applyPresetFilter = (photoId: string, filterId: string) => {
    setPhotos(prev =>
      prev.map(p => (p.id === photoId ? { ...p, filter: filterId } : p))
    );
  };

  // Save manual modifications to title, location, tags
  const handleSaveMeta = (photoId: string) => {
    const listTags = editTags
      .split(",")
      .map(t => t.trim().toLowerCase())
      .filter(t => t !== "");

    setPhotos(prev =>
      prev.map(p =>
        p.id === photoId
          ? {
              ...p,
              title: editTitle || p.title,
              location: editLocation || p.location,
              tags: listTags.length > 0 ? listTags : p.tags,
            }
          : p
      )
    );
    setIsEditingMeta(false);
  };

  // Delete a specific photo
  const handleDeletePhoto = (photoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this photo permanently from the gallery?")) {
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setCurrentLightboxIndex(null);
    }
  };

  // Handle image drag and drop parsing
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file (PNG, JPG, WebP)");
      return;
    }
    const cleanName = file.name.split(".")[0].replace(/[-_]/g, " ");
    const formattedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      
      const MAX_SIZE = 1200;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Compress to 70% quality JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setUploadImageFile(dataUrl);
        setUploadTitle(formattedTitle);
      }
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  };

  const handleManualFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      const files = filesArray.filter(f => f.type.startsWith("image/"));
      if (files.length === 0) {
        alert("No images found in the selected folder.");
        return;
      }
      setIsBulkUploading(true);
      setBulkProgress(0);
      setBulkTotal(files.length);
      
      const newPhotos: Photo[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const cleanName = file.name.split(".")[0].replace(/[-_]/g, " ");
          const formattedTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          
          const objectUrl = URL.createObjectURL(file);
          
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const MAX_SIZE = 1200;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > MAX_SIZE) {
                  height *= MAX_SIZE / width;
                  width = MAX_SIZE;
                }
              } else {
                if (height > MAX_SIZE) {
                  width *= MAX_SIZE / height;
                  height = MAX_SIZE;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
              } else {
                reject(new Error("No canvas context"));
              }
            };
            img.onerror = reject;
            img.src = objectUrl;
          });
          
          URL.revokeObjectURL(objectUrl);
          
          newPhotos.push({
            id: "f_" + Date.now() + "_" + i,
            url: dataUrl,
            title: formattedTitle || "Folder Image",
            album: uploadAlbum,
            date: new Date().toISOString().split("T")[0],
            location: "Local Device",
            tags: ["import"],
            size: "1.0 MB",
            favorite: false,
            filter: "normal",
            originalUrl: dataUrl,
            aiGenerated: false,
            description: "Imported from local folder.",
          });
          
        } catch (err) {
          console.error("Failed to process file during bulk upload", err);
        }
        setBulkProgress(i + 1);
        
        // Small delay to keep UI responsive
        if (i % 10 === 0) {
           await new Promise(r => setTimeout(r, 10));
        }
      }
      
      setPhotos(prev => [...newPhotos, ...prev]);
      setIsBulkUploading(false);
      alert(`Successfully imported ${newPhotos.length} images.`);
      setActiveTab("photos");
    }
  };

  const triggerUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadImageFile) {
      alert("Please select or drop an image file first.");
      return;
    }

    const tKeywords = uploadTags
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(k => k !== "");

    const newPhoto: Photo = {
      id: "u_" + Date.now(),
      url: uploadImageFile,
      title: uploadTitle || "Untitled Upload",
      album: uploadAlbum,
      date: new Date().toISOString().split("T")[0],
      location: uploadLocation || "Local Upload",
      tags: tKeywords.length > 0 ? tKeywords : ["upload"],
      size: uploadSize,
      favorite: false,
      filter: "normal",
      originalUrl: uploadImageFile,
      aiGenerated: false,
      description: "A moments captured and hand-inserted in the Android responsive gallery.",
      isSyncedToDrive: addPhotoSource === "drive",
      driveFileId: addPhotoSource === "drive" ? extractDriveFileId(driveUrl) : undefined,
    };

    setPhotos(prev => [newPhoto, ...prev]);
    
    // Reset fields
    setUploadTitle("");
    setUploadLocation("");
    setUploadTags("");
    setUploadImageFile(null);
    setUploadSize("1.5 MB");
    setActiveTab("photos");
    setSelectedAlbum(uploadAlbum);
  };

  // Trigger Gemini AI Image Recognition
  const triggerGeminidAnalysis = async (photo: Photo, targetType: "description" | "story" = "description") => {
    if (targetType === "story") {
      setAiStoryLoading(true);
    } else {
      setIsAnalyzing(true);
    }
    setAiError(null);

    try {
      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: photo.url.startsWith("data:") ? photo.url : undefined,
          mimeType: photo.url.startsWith("data:") ? photo.url.substring(5, photo.url.indexOf(";")) : undefined,
          metaTitle: photo.title,
          metaTags: photo.tags,
          requestType: targetType,
        }),
      });

      const data = await response.json();
      if (!response.ok || data.status === "error") {
        throw new Error(data.message || "An exception occurred during Gemini connection.");
      }

      if (targetType === "story") {
        setAiAnalysis(prev => prev ? { ...prev, story: data.story } : { description: "Unanalyzed", suggestedTags: [], story: data.story });
      } else {
        setAiAnalysis({
          description: data.description,
          suggestedTags: data.suggestedTags || [],
          palette: data.palette || [],
        });

        // Update photo's real description state in local photos array
        setPhotos(prev =>
          prev.map(p =>
            p.id === photo.id
              ? { ...p, description: data.description }
              : p
          )
        );
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "Unable to retrieve smart response from Gemini service.");
    } finally {
      setIsAnalyzing(false);
      setAiStoryLoading(false);
    }
  };

  const importAITags = (photoId: string, tagsToImport: string[]) => {
    setPhotos(prev =>
      prev.map(p => {
        if (p.id === photoId) {
          const combined = Array.from(new Set([...p.tags, ...tagsToImport.map(t => t.toLowerCase())]));
          // Set in current edits as well
          setEditTags(combined.join(", "));
          return { ...p, tags: combined };
        }
        return p;
      })
    );
    // Remove tags from suggestion lists
    setAiAnalysis(prev => prev ? { ...prev, suggestedTags: [] } : null);
  };

  // Album icon helper
  const renderAlbumIcon = (iconName: string, className = "w-5 h-5") => {
    switch (iconName) {
      case "Camera": return <Camera className={className} />;
      case "Compass": return <Compass className={className} />;
      case "Building2": return <Building2 className={className} />;
      case "Trees": return <Trees className={className} />;
      default: return <ImageIcon className={className} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-accent relative" id="gallery-app-root">
      
      {/* Dynamic top adaptive header bar */}
      <div className="w-full bg-[#060606] border-b border-white/10 px-3 py-2.5 sm:px-6 sm:py-3.5 flex items-center justify-between gap-1.5 sm:gap-2.5 shrink-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-3">
          {selectedAlbum !== "all" ? (
            <button
              onClick={() => setSelectedAlbum("all")}
              className="p-1 px-2.5 sm:px-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-mono uppercase tracking-wider text-accent cursor-pointer flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-3 h-3 text-white/60" />
              <span>Albums</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-accent/40 font-mono text-xs select-none">•</span>
              <span className="font-serif italic text-sm tracking-wide text-accent">L. Gallery</span>
            </div>
          )}
          
          {selectedAlbum !== "all" && (
            <span className="text-xs text-white/50 font-serif italic truncate max-w-[90px] sm:max-w-xs block">
              / {albums.find(a => a.id === selectedAlbum)?.name}
            </span>
          )}
        </div>

        {/* Quick Actions */}
        {filteredPhotos.length > 0 && activeTab === "photos" && (
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedPhotos(new Set());
              }}
              className={`flex items-center gap-1 border py-1 px-2.5 sm:py-1.5 sm:px-4 rounded-full text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-all ${
                isSelectionMode 
                  ? "bg-accent text-accent-fg border-accent" 
                  : "bg-white/5 border-white/10 text-accent/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <span>{isSelectionMode ? "Cancel" : "Select"}</span>
            </button>
            
            {!isSelectionMode && (
              <>
                <button
                  onClick={() => setGridColumns(prev => prev === 2 ? 3 : prev === 3 ? 4 : 2)}
                  className="flex items-center gap-1 bg-white/5 border border-white/10 text-accent/80 hover:text-white hover:bg-white/10 p-1.5 sm:py-1.5 sm:px-3 rounded-full text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-all"
                  title={`Toggle Grid Density (${gridColumns} columns)`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{gridColumns} Cols</span>
                </button>
                <button
                  onClick={() => setSortOrder(prev => prev === "newest" ? "oldest" : "newest")}
                  className="flex items-center gap-1 bg-white/5 border border-white/10 text-accent/80 hover:text-white hover:bg-white/10 p-1.5 sm:py-1.5 sm:px-3 rounded-full text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-all"
                  title={`Sort by: ${sortOrder === "newest" ? "Newest First" : "Oldest First"}`}
                >
                  {sortOrder === "newest" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{sortOrder === "newest" ? "Newest" : "Oldest"}</span>
                </button>
                <button
                  onClick={() => handleStartSlideshow()}
                  className="flex items-center gap-1 bg-white/5 border border-white/10 text-accent/80 hover:text-white hover:bg-white/10 p-1.5 sm:py-1.5 sm:px-4 rounded-full text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold cursor-pointer transition-all"
                  title="Start Slideshow"
                >
                  <Play className="w-3 h-3 text-white/80 fill-white/60" />
                  <span className="hidden sm:inline">SlideShow</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>


      {/* Main viewport body layout adapts based on device view Mode */}
      <div className="flex-1 overflow-hidden flex flex-row">
        
        {/* Sidemenu navigation: Show on tablet / desktop view configs, hide on mobile */}
        <aside className="hidden md:flex w-60 bg-[#060606] border-r border-white/10 flex flex-col justify-between shrink-0 select-none">
            <div className="p-5 flex flex-col gap-6">
              {/* Media Categories header */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase px-2">Core Hub</span>
                <nav className="flex flex-col gap-1.5 relative">
                  <button
                    onClick={() => setActiveTab("photos")}
                    className={`relative w-full flex items-center justify-between px-4 py-2.5 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)] text-xs cursor-pointer transition-all duration-350 ${
                      activeTab === "photos"
                        ? "text-accent-fg font-bold"
                        : "font-semibold text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {activeTab === "photos" && (
                      <motion.div
                        layoutId="activeSidebarTab"
                        className="absolute inset-0 bg-accent z-0 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-2.5">
                      <ImageIcon className="w-4 h-4 text-inherit" />
                      <span>All Media</span>
                    </div>
                    <span className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full transition-colors duration-300 ${
                      activeTab === "photos" ? "bg-black/20 text-accent-fg" : "bg-white/5 text-white/40 border border-white/5"
                    }`}>{photos.length}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("albums")}
                    className={`relative w-full flex items-center justify-between px-4 py-2.5 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)] text-xs cursor-pointer transition-all duration-350 ${
                      activeTab === "albums"
                        ? "text-accent-fg font-bold"
                        : "font-semibold text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {activeTab === "albums" && (
                      <motion.div
                        layoutId="activeSidebarTab"
                        className="absolute inset-0 bg-accent z-0 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <div className="relative z-10 flex items-center gap-2.5">
                      <Compass className="w-4 h-4 text-inherit" />
                      <span>Albums Folder</span>
                    </div>
                    <span className={`relative z-10 text-[10px] px-2 py-0.5 rounded-full transition-colors duration-300 ${
                      activeTab === "albums" ? "bg-black/20 text-accent-fg" : "bg-white/5 text-white/40 border border-white/5"
                    }`}>
                      {albums.length - 1}
                    </span>
                  </button>
                </nav>
              </div>

              {/* Photos filters */}
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase px-2">Folders</span>
                <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                  {albums.map((item) => {
                    const count = photos.filter(p => item.id === "all" || p.album === item.id).length;
                    const isSelected = selectedAlbum === item.id && activeTab === "photos";
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedAlbum(item.id);
                          setActiveTab("photos");
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)] text-xs cursor-pointer transition-all ${
                          isSelected
                            ? "bg-white/5 text-accent border border-white/10 font-bold"
                            : "text-white/50 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {renderAlbumIcon(item.iconName, "w-3.5 h-3.5 text-white/40")}
                          <span className="truncate">{item.name}</span>
                        </div>
                        <span className="text-[9px] text-accent/50 font-mono">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interactions tab */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setActiveTab("magic")}
                  className={`relative w-full flex items-center justify-between px-4 py-2.5 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)] text-xs font-semibold cursor-pointer transition-all duration-350 ${
                    activeTab === "magic"
                      ? "bg-white/5 border border-purple-500/10 text-[#d8c8ff] font-bold"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Gemini AI Lab</span>
                  </div>
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`relative w-full flex items-center justify-between px-4 py-2.5 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)] text-xs font-semibold cursor-pointer transition-all duration-350 ${
                    activeTab === "settings"
                      ? "text-accent-fg font-bold"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {activeTab === "settings" && (
                    <motion.div
                      layoutId="activeSidebarTab"
                      className="absolute inset-0 bg-accent z-0 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-inherit" />
                    <span>Settings</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Quick insert section */}
            <div className="p-5 border-t border-white/10">
              <button
                onClick={() => setActiveTab("add")}
                className="w-full bg-white hover:bg-white/90 text-black font-bold py-2.5 px-4 [clip-path:polygon(12px_0,calc(100%-12px)_0,100%_12px,100%_calc(100%-12px),calc(100%-12px)_100%,12px_100%,0_calc(100%-12px),0_12px)] text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all duration-500 hover:opacity-80 hover:shadow-[0_0_15px_rgba(255,255,255,0.3)]"
              >
                <Plus className="w-4 h-4" />
                Incorporate Asset
              </button>
            </div>
          </aside>

        {/* Core Content Area Scroll Container */}
        <div className="flex-1 overflow-y-auto bg-[#050505] p-5 scrollbar-thin scrollbar-thumb-white/5 pb-28 md:pb-6 relative">
          <AnimatePresence mode="popLayout">
            
            {/* TAB: PHOTOS VIEW */}
            {activeTab === "photos" && (
              <motion.div
                key="tab-photos"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col gap-5"
              >
                {/* Search and Filters Strip */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0a0a0a] p-4 rounded-3xl border border-white/5 select-none animate-fade-in">
                  <div className="flex-1 relative flex items-center">
                    <Search className="w-4 h-4 text-white/30 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Fuzzy search memory collections, locations, tags..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black border border-white/10 focus:border-accent/55 outline-none rounded-full pl-10 pr-4 py-2.5 text-xs text-accent placeholder-white/30 transition-all font-sans"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="p-1.5 text-white/40 hover:text-white absolute right-3.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Favorites and Scope filters */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActiveFilterTab("all")}
                      className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-350 ${
                        activeFilterTab === "all"
                          ? "bg-accent text-black"
                          : "border border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      All Media
                    </button>
                    <button
                      onClick={() => setActiveFilterTab("favorites")}
                      className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1.5 transition-all duration-350 ${
                        activeFilterTab === "favorites"
                          ? "bg-accent text-black"
                          : "border border-white/10 text-white/60 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${activeFilterTab === "favorites" ? "fill-black" : "fill-white/40"}`} />
                      Favorites
                    </button>
                  </div>
                </div>


                {/* Empty State visualizer */}
                {filteredPhotos.length === 0 && (
                  <div className="w-full flex flex-col items-center justify-center py-20 text-center select-none">
                    <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-4 text-white/50">
                      <ImageIcon className="w-6 h-6 text-white/30" />
                    </div>
                    <h3 className="font-serif italic text-accent text-base">No collections found</h3>
                    <p className="text-[11px] text-white/40 max-w-xs mt-1 font-sans">
                      No assets match the current filters or fuzzy queries. Reset parameters to view the whole catalog.
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedAlbum("all");
                        setActiveFilterTab("all");
                      }}
                      className="mt-5 px-5 py-2 border border-white/15 bg-white text-black hover:bg-accent uppercase tracking-widest text-[9px] font-bold rounded-full cursor-pointer transition-all duration-300"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}

                {/* Grid Container */}
                <motion.div 
                  layout
                  transition={{ type: "spring", stiffness: 280, damping: 28 }}
                  className={`grid gap-4 ${
                    gridColumns === 2 ? "grid-cols-2" :
                    gridColumns === 3 ? "grid-cols-3" :
                    "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                  }`}
                >
                  <AnimatePresence mode="popLayout">
                    {filteredPhotos.map((photo, index) => {
                      // Find relative index in source array
                      return (
                        <motion.div
                          key={photo.id}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ 
                            opacity: { duration: 0.25 },
                            layout: { type: "spring", stiffness: 280, damping: 28, mass: 0.6 }
                          }}
                          style={{ willChange: "transform, opacity" }}
                          onPointerDown={() => handlePointerDown(photo.id)}
                          onContextMenu={(e) => e.preventDefault()}
                          onPointerUp={handlePointerUpOrLeave}
                          onPointerLeave={handlePointerUpOrLeave}
                          onPointerCancel={handlePointerUpOrLeave}
                          onClick={() => {
                            if (isSelectionMode) {
                              togglePhotoSelection(photo.id);
                            } else {
                              handleOpenLightbox(index);
                            }
                          }}
                          className={`aspect-square bg-white/10 rounded-2xl overflow-hidden border shadow-md group relative cursor-pointer select-none transition-all duration-300 ${
                            isSelectionMode && selectedPhotos.has(photo.id)
                              ? "border-emerald-500/80 scale-95"
                              : "border-white/5 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]"
                          }`}
                        >
                          {/* Image rendering with dynamic CSS filter */}
                          <motion.img
                            layoutId={`img-${photo.id}`}
                            src={photo.url}
                            alt={photo.title}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            style={{ willChange: "transform, opacity" }}
                            className={`w-full h-full object-cover transition-transform duration-700 ${
                              isSelectionMode && selectedPhotos.has(photo.id) ? "" : "group-hover:scale-105"
                            } ${
                              FILTER_PRESETS.find(f => f.id === photo.filter)?.class || ""
                            }`}
                          />

                          {/* Selection Overlay */}
                          {isSelectionMode && (
                            <div className="absolute inset-0 bg-black/20 z-10 transition-colors">
                              <div className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selectedPhotos.has(photo.id) 
                                  ? "bg-emerald-500 border-emerald-500" 
                                  : "border-white/50 bg-black/40 backdrop-blur-sm"
                              }`}>
                                {selectedPhotos.has(photo.id) && <Check className="w-3 h-3 text-white" />}
                              </div>
                            </div>
                          )}

                          {/* Top gradient gradient shadows */}
                          <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none opacity-40 transition-opacity duration-350 ${
                            isSelectionMode ? "hidden" : "group-hover:opacity-100"
                          }`} />

                          {/* Top pill markings (favorite / AI indicator) */}
                          <div className={`absolute top-3 right-3 flex items-center gap-1.5 z-20 ${isSelectionMode ? "hidden" : ""}`}>
                            {photo.favorite && (
                              <button
                                onClick={(e) => toggleFavorite(photo.id, e)}
                                className="w-7 h-7 bg-black/70 backdrop-blur-md text-rose-400 rounded-full flex items-center justify-center hover:bg-black transition border border-white/5"
                              >
                                <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                              </button>
                            )}
                            {photo.description && (
                              <div className="w-7 h-7 bg-purple-500/10 backdrop-blur-md rounded-full flex items-center justify-center text-purple-300 border border-purple-500/25">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                              </div>
                            )}
                          </div>

                          {/* Description details card reveal on hover */}
                          <div className={`absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black via-black/85 to-transparent p-3.5 flex items-end justify-between transition-all duration-300 opacity-100 sm:opacity-0 ${isSelectionMode ? "hidden" : "group-hover:opacity-100"}`}>
                            <div className="overflow-hidden pr-2">
                              <h4 className="text-xs font-serif italic text-accent truncate tracking-wide">{photo.title}</h4>
                              <p className="text-[9px] uppercase tracking-wider text-white/40 flex items-center gap-0.5 truncate mt-0.5">
                                <MapPin className="w-2.5 h-2.5 text-white/30 shrink-0" />
                                <span className="truncate">{photo.location}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenLightbox(index);
                                }}
                                className="px-2.5 py-1 text-[9px] tracking-wider uppercase bg-accent text-black font-semibold rounded-full hover:bg-white transition"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            )}

            {/* TAB: ALBUMS FOLDERS VIEW */}
            {activeTab === "albums" && (
              <motion.div
                key="tab-albums"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in"
              >
                {albums.map((item) => {
                  const count = photos.filter(p => item.id === "all" || p.album === item.id).length;
                  return (
                    <motion.div
                      whileHover={{ y: -3 }}
                      key={item.id}
                      onClick={() => {
                        setSelectedAlbum(item.id);
                        setActiveTab("photos");
                      }}
                      className="bg-white/5 rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 h-40 shadow-xl flex cursor-pointer relative group select-none transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <div className="w-2/5 h-full relative overflow-hidden bg-black border-r border-white/5">
                        <img
                          src={item.coverUrl}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors" />
                      </div>
                      
                      <div className="flex-1 p-5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 text-accent flex items-center justify-center">
                            {renderAlbumIcon(item.iconName, "w-4 h-4 text-accent")}
                          </div>
                          <span className="text-[9px] font-mono uppercase tracking-widest text-white/30">Folder</span>
                        </div>

                        <div>
                          <h3 className="font-serif italic text-base text-accent tracking-wide group-hover:text-white transition-colors">{item.name}</h3>
                          <p className="text-[11px] font-sans text-white/40 mt-1">
                            <span>{count} {count === 1 ? 'Asset element' : 'Asset elements'}</span>
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* TAB: UPLOAD FLOW */}
            {activeTab === "add" && (
              <motion.div
                key="tab-add"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto bg-[#0d0d0d] border border-white/5 rounded-[28px] p-6 shadow-2xl relative select-none animate-fade-in"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-accent">
                    {addPhotoSource === "local" ? (
                      <UploadCloud className="w-5 h-5 text-inherit" />
                    ) : (
                      <Cloud className="w-5 h-5 text-inherit animate-pulse" />
                    )}
                  </div>
                  <div>
                    <h2 className="font-serif italic text-accent text-lg">Incorporate Assets</h2>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-mono mt-0.5">
                      {addPhotoSource === "local" ? "Import localized image files to test rendering" : "Fetch assets directly from your Google Drive"}
                    </p>
                  </div>
                </div>

                {/* Method selector */}
                <div className="grid grid-cols-2 gap-1 bg-black/85 p-1 rounded-full border border-white/5 mb-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAddPhotoSource("local");
                      setUploadImageFile(null);
                      setDriveError(null);
                    }}
                    className={`py-1.5 px-4 rounded-full text-[10px] font-mono uppercase tracking-wider text-center cursor-pointer transition ${
                      addPhotoSource === "local"
                        ? "bg-accent text-accent-fg font-semibold"
                        : "text-accent/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Local File
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddPhotoSource("drive");
                      setUploadImageFile(null);
                      setDriveError(null);
                    }}
                    className={`py-1.5 px-4 rounded-full text-[10px] font-mono uppercase tracking-wider text-center cursor-pointer transition ${
                      addPhotoSource === "drive"
                        ? "bg-accent text-accent-fg font-semibold"
                        : "text-accent/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    Google Drive
                  </button>
                </div>

                <form onSubmit={triggerUploadSubmit} className="flex flex-col gap-4">
                  {addPhotoSource === "local" ? (
                    /* Drag drop slot */
                    <div className="flex flex-col gap-4">
                      {isBulkUploading ? (
                        <div className="w-full py-8 border border-white/10 bg-black/40 rounded-2xl flex flex-col items-center justify-center gap-4">
                          <div className="text-accent font-sans text-sm mb-2 text-center">
                            Importing Images...<br />
                            <span className="text-white/50 text-xs">This may take a moment</span>
                          </div>
                          <div className="w-[80%] max-w-sm h-1 bg-white/10 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-emerald-500"
                              initial={{ width: "0%" }}
                              animate={{ width: `${(bulkProgress / bulkTotal) * 100}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-mono text-white/40 tracking-wider">
                            {bulkProgress} / {bulkTotal}
                          </div>
                        </div>
                      ) : (
                        <div
                          onDragEnter={handleDrag}
                          onDragLeave={handleDrag}
                          onDragOver={handleDrag}
                          onDrop={handleDrop}
                          className={`w-full py-10 border border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition select-none cursor-pointer ${
                            dragActive
                              ? "border-accent bg-white/5"
                              : "border-white/10 bg-black/40 hover:border-white/20"
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleManualFileSelect}
                            className="hidden"
                          />
                          <input
                            ref={folderInputRef}
                            type="file"
                            accept="image/*"
                            // @ts-ignore : React doesn't fully support webkitdirectory typing yet
                            webkitdirectory=""
                            directory=""
                            onChange={handleFolderSelect}
                            className="hidden"
                          />

                          {uploadImageFile ? (
                            <div className="flex flex-col items-center gap-3 w-full" onClick={() => fileInputRef.current?.click()}>
                              <img
                                src={uploadImageFile}
                                alt="upload preview"
                                className="w-28 h-28 object-cover rounded-2xl border border-white/10 shadow-md cursor-pointer transition-transform hover:scale-105"
                              />
                              <span className="text-xs font-semibold text-accent flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Selected Successfully
                              </span>
                              <span className="text-[10px] text-white/30 cursor-pointer hover:underline">Click to replace</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-4 py-2 w-full">
                              <UploadCloud className="w-8 h-8 text-white/30 pointer-events-none" />
                              <div className="flex flex-col gap-1 items-center">
                                <span className="text-xs text-white/60 font-medium pointer-events-none">
                                  Drag & drop picture file here
                                </span>
                                <span className="text-[9px] text-white/30 font-mono pointer-events-none">Supports PNG, JPEG, WebP</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                  }}
                                  className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono tracking-widest uppercase px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" /> File
                                </button>
                                <span className="text-[10px] text-white/30 font-serif italic">or</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    folderInputRef.current?.click();
                                  }}
                                  className="bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono tracking-widest uppercase px-4 py-2 rounded-full transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <Folder className="w-3.5 h-3.5" /> Folder
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Google Drive download form */
                    <div className="w-full bg-black/40 border border-white/10 p-5 rounded-2xl flex flex-col gap-4">
                      {!driveUser ? (
                        <div className="text-center py-6 flex flex-col items-center gap-3">
                          <Cloud className="w-8 h-8 text-white/30" />
                          <div className="text-xs text-accent/80">
                            Connect your Google Drive account safely to browse and pull your images with permission.
                          </div>
                          
                          <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            className="mt-2 px-5 py-2 hover:opacity-90 active:scale-95 transition-all text-xs border border-white/10 flex items-center gap-2 justify-center rounded-full bg-neutral-900 text-white cursor-pointer font-sans"
                            id="drive-sign-in-button"
                          >
                            <svg className="w-4 h-4 shrink-0" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            </svg>
                            <span>Connect Google Drive</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] font-mono tracking-wide text-white/50">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Active Connection: {driveUser.email}</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleGoogleSignOut}
                              className="text-rose-400 hover:text-rose-300 font-mono text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition"
                              title="Disconnect account"
                            >
                              <LogOut className="w-3 h-3" /> Disconnect
                            </button>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="block text-[9px] font-mono tracking-widest text-accent/50 uppercase">Drive Link or File ID</label>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                <input
                                  type="text"
                                  placeholder="Paste Google Drive shared image link..."
                                  value={driveUrl}
                                  onChange={(e) => setDriveUrl(e.target.value)}
                                  className="w-full bg-black/60 border border-white/10 focus:border-accent/40 outline-none rounded-xl pl-9 pr-4 py-2.5 text-xs text-accent placeholder-white/20 font-sans transition-all"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleFetchGoogleDriveFile}
                                disabled={isFetchingDrive}
                                className="bg-white hover:bg-accent text-black text-[10px] font-mono uppercase tracking-widest px-5 py-2.5 rounded-full disabled:opacity-50 transition shrink-0 cursor-pointer flex items-center justify-center min-w-[80px]"
                              >
                                {isFetchingDrive ? (
                                  <Loader className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  "Fetch"
                                )}
                              </button>
                            </div>
                          </div>

                          {uploadImageFile && (
                            <div className="mt-2 bg-black/60 border border-white/5 rounded-2xl p-3.5 flex items-center gap-3.5 animate-fade-in">
                              <img
                                src={uploadImageFile}
                                alt="drive preview"
                                className="w-16 h-16 object-cover rounded-xl border border-white/10 shrink-0"
                              />
                              <div className="flex-1 overflow-hidden">
                                <div className="text-xs font-semibold text-accent truncate">{uploadTitle || "Fetched Image"}</div>
                                <div className="text-[10px] text-white/40 mt-1 flex items-center gap-3">
                                  <span>Format: Image</span>
                                  <span>•</span>
                                  <span>Size: {uploadSize}</span>
                                </div>
                                <div className="text-[9px] font-mono text-emerald-500 mt-1.5 flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Cached and ready to import
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {driveError && (
                    <div className="bg-rose-950/20 text-rose-400 border border-rose-500/25 p-3.5 rounded-xl text-[10px] font-mono animate-shake">
                      Error: {driveError}
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="flex flex-col gap-3.5">
                    <div>
                      <label className="block text-[9px] font-mono tracking-widest text-accent/50 uppercase mb-1.5">Asset Designation</label>
                      <input
                        type="text"
                        placeholder="e.g. Whispering Groves"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 focus:border-accent/40 outline-none rounded-xl px-4 py-2.5 text-xs text-accent placeholder-white/20 font-sans transition-all"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-[9px] font-mono tracking-widest text-accent/50 uppercase mb-1.5">Destination Folder</label>
                        <select
                          value={uploadAlbum}
                          onChange={(e) => setUploadAlbum(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 focus:border-accent/40 outline-none rounded-xl px-4 py-2.5 text-xs text-accent font-sans transition-all"
                        >
                          <option value="camera">Camera Roll</option>
                          <option value="wanderlust">Wanderlust</option>
                          <option value="metropolis">Metropolis</option>
                          <option value="nature">Pure Nature</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-mono tracking-widest text-accent/50 uppercase mb-1.5">Location capture</label>
                        <input
                          type="text"
                          placeholder="e.g. Kyoto, Japan"
                          value={uploadLocation}
                          onChange={(e) => setUploadLocation(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 focus:border-accent/40 outline-none rounded-xl px-4 py-2.5 text-xs text-accent placeholder-white/20 font-sans transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-mono tracking-widest text-accent/50 uppercase mb-1.5">Tags (separated by comma)</label>
                      <input
                        type="text"
                        placeholder="sunset, peace, architecture"
                        value={uploadTags}
                        onChange={(e) => setUploadTags(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 focus:border-accent/40 outline-none rounded-xl px-4 py-2.5 text-xs text-accent placeholder-white/20 font-sans transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-white hover:bg-accent text-black font-semibold uppercase tracking-wider py-2.5 text-[10px] rounded-full active:scale-95 transition-all mt-3 cursor-pointer shadow-md"
                  >
                    Confirm Import
                  </button>
                </form>
              </motion.div>
            )}

            {/* TAB: GEMINI AI MAGIC EXPERIENCES */}
            {activeTab === "magic" && (
              <motion.div
                key="tab-magic"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto bg-[#0d0d0d] border border-white/5 rounded-[28px] p-6 shadow-2xl select-none animate-fade-in"
              >
                <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
                  <div className="w-10 h-10 bg-[#d8c8ff]/10 border border-[#d8c8ff]/25 rounded-full flex items-center justify-center text-[#d8c8ff]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-serif italic text-accent text-lg">Gemini AI Assistant</h2>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-mono mt-0.5">Your interactive metadata & catalog processor</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="bg-black/60 p-5 rounded-2xl border border-white/5 flex items-start gap-3">
                    <Info className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-serif italic text-accent">How Gemini Enhances Your Device Gallery</h4>
                      <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed font-sans">
                        By integrating server-side Gemini AI processing directly into your gallery core, you can analyze colors, lighting, and contents. Open any photo grid item, click **Analyze Image with AI** to generate description layers or narrative stories on the fly!
                      </p>
                    </div>
                  </div>

                  {/* Curated Semantic Queries */}
                  <div className="flex flex-col gap-2 relative z-10">
                    <span className="text-[9px] font-mono tracking-widest text-accent/50 uppercase px-1">Curated Semantic Queries</span>
                    <p className="text-[11px] text-white/40 px-1 mb-2 font-sans">Use the search box in the main media tab to run fuzzy semantic text match queries, like:</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      {[
                        { q: "sunset", desc: "Filters beach sunset items" },
                        { q: "serene", desc: "Reveals misty mountains and peaceful walkways" },
                        { q: "neon", desc: "Reveals night glows & cyber alleyways" },
                        { q: "europe", desc: "Instant Lake Como matches" },
                      ].map((item, idx) => (
                        <button
                          key={idx}
                          id={`query-pill-${idx}`}
                          onClick={() => {
                            setSearchQuery(item.q);
                            setActiveTab("photos");
                          }}
                          className="bg-black/60 border border-white/10 hover:border-accent/55 p-3.5 rounded-2xl text-left transition cursor-pointer text-xs group"
                        >
                          <span className="font-serif italic text-sm text-accent group-hover:text-accent-fg transition">"{item.q}"</span>
                          <p className="text-[10px] text-white/40 mt-1 truncate font-sans">{item.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Gallery Curator */}
                  <div className="bg-black/60 border border-white/10 p-5 rounded-2xl relative overflow-hidden mt-2 z-10">
                    <div className="absolute right-0 top-0 translate-y-6 translate-x-4 opacity-[0.03] pointer-events-none">
                      <Sparkles className="w-44 h-44 text-white" />
                    </div>
                    <span className="text-[9px] font-mono text-accent/60 tracking-widest uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
                      <BookOpen className="w-3.5 h-3.5" /> Curator Module
                    </span>
                    <div className="mt-4">
                      {gallerySummary ? (
                        <div className="text-sm font-sans text-white/80 leading-relaxed font-light whitespace-pre-wrap relative z-10">
                          {gallerySummary}
                        </div>
                      ) : (
                        <p className="text-xs text-white/40 mb-4 font-sans max-w-sm relative z-10">
                          Have Gemini analyze your entire photo collection and generate a creative characterization of your unique photography style.
                        </p>
                      )}
                      
                      <button
                        disabled={isGeneratingSummary}
                        onClick={handleGenerateGallerySummary}
                        className="mt-2 bg-white hover:bg-accent disabled:bg-white/10 text-black disabled:text-white/40 text-[10px] uppercase tracking-wider font-bold py-2.5 px-5 rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-md relative z-10"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                            Analyzing Gallery...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" /> {gallerySummary ? "Regenerate Summary" : "Generate Gallery Summary"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: SETTINGS */}
            {activeTab === "settings" && (
              <motion.div
                key="tab-settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto bg-[#0d0d0d] border border-white/5 rounded-[28px] p-6 shadow-2xl select-none animate-fade-in"
              >
                <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
                  <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-accent">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-serif italic text-accent text-lg">Platform Settings</h2>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 font-mono mt-0.5">Customize your gallery environment</p>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Theme Engine Selector */}
                  <div>
                    <label className="block text-[9px] font-mono tracking-widest text-accent/50 uppercase mb-3">Accent Colors</label>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { id: "default", name: "Slate Default", hex: "#E0D8D0" },
                        { id: "emerald", name: "Jade Green", hex: "#10b981" },
                        { id: "rose", name: "Rose Bloom", hex: "#f43f5e" },
                        { id: "amber", name: "Amber Glow", hex: "#f59e0b" },
                      ].map((theme) => (
                        <button
                          key={theme.id}
                          onClick={() => setThemeName(theme.id)}
                          className={`flex flex-col items-center justify-center py-4 px-2 rounded-2xl border transition-all cursor-pointer ${
                            themeName === theme.id ? "bg-white/10 border-accent text-accent shadow-[0_0_15px_-3px_var(--theme-accent)]" : "bg-black/60 border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full mb-2 shadow-inner border border-white/20" style={{ backgroundColor: theme.hex }}></div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-center leading-tight">{theme.name}</span>
                        </button>
                      ))}
                      
                      {/* CUSTOM COLOR PICKER */}
                      <label
                        className={`relative flex flex-col items-center justify-center py-4 px-2 rounded-2xl border transition-all cursor-pointer ${
                          themeName.startsWith("#") ? "bg-white/10 border-accent text-accent shadow-[0_0_15px_-3px_var(--theme-accent)]" : "bg-black/60 border-white/10 text-white/50 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full mb-2 shadow-inner border border-white/20 overflow-hidden relative" style={{ background: themeName.startsWith("#") ? themeName : "conic-gradient(red, yellow, green, cyan, blue, magenta, red)" }}>
                          <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-[200%] h-[200%] -top-[50%] -left-[50%]" value={themeName.startsWith("#") ? themeName : "#E0D8D0"} onChange={(e) => setThemeName(e.target.value)} />
                        </div>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-center leading-tight">Custom</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Google Drive Status */}
                  <div className="border-t border-white/10 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Cloud className="w-4 h-4 text-accent" />
                      <label className="block text-[9px] font-mono tracking-widest text-accent/50 uppercase">Drive Sync Settings</label>
                    </div>
                    
                    <div className="bg-[#050505] p-5 rounded-2xl border border-white/5 mb-4">
                      <label className="block text-[9px] font-mono tracking-widest text-white/60 uppercase mb-2">Target Folder ID (Optional)</label>
                      <input 
                        type="text" 
                        value={syncFolderId}
                        onChange={(e) => setSyncFolderId(e.target.value)}
                        placeholder="e.g. 1a2B3c4D5e6F7g8H9i0J"
                        className="w-full bg-black/60 border border-white/10 focus:border-accent/40 outline-none rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/20 font-sans mb-1 transition-all"
                      />
                      <p className="text-[10px] text-white/40 mb-4">Paste the ID from a Google Drive folder URL to save verified local uploads centrally.</p>
                      
                      <div className="flex flex-col md:flex-row items-center gap-3">
                        <select 
                          value={syncTargetAlbum}
                          onChange={(e) => setSyncTargetAlbum(e.target.value)}
                          className="w-full md:w-auto bg-black/60 border border-white/10 text-xs px-3 py-2.5 rounded-xl outline-none font-mono text-white/70"
                        >
                          {albums.map(album => (
                            <option key={album.id} value={album.id}>{album.name}</option>
                          ))}
                        </select>
                        <div className="flex-1 w-full text-[10px]/relaxed bg-black/60 p-3 border border-white/10 rounded-xl">
                          <span className="font-semibold text-white/70">Sync Status: </span>
                          {photos.filter(p => !p.isSyncedToDrive && (syncTargetAlbum === "all" || p.album === syncTargetAlbum)).length === 0 ? (
                            <span className="text-emerald-400">All media backed up to cloud</span>
                          ) : (
                            <span className="text-rose-400">{photos.filter(p => !p.isSyncedToDrive && (syncTargetAlbum === "all" || p.album === syncTargetAlbum)).length} items pending sync</span>
                          )}
                        </div>
                        <button 
                          disabled={isSyncing}
                          onClick={() => handleSyncToDrive(syncTargetAlbum)} 
                          className="w-full md:w-auto bg-white hover:bg-accent text-black hover:text-accent-fg font-semibold px-5 py-3 rounded-full text-[10px] tracking-widest uppercase transition-all whitespace-nowrap active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isSyncing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
                          Sync Unsaved Media
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* MOBILE HUD INTERFACE: Shows on small/mobile layouts, hides on md and larger */}
      <nav className="md:hidden flex fixed bottom-0 left-0 right-0 bg-[#060606]/95 backdrop-blur-md border-t border-white/10 py-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] px-4 flex justify-around items-center z-40 select-none shrink-0 shadow-[0_-5px_25px_rgba(0,0,0,0.5)]" id="mobile-navigation-bar">
          <button
            onClick={() => setActiveTab("photos")}
            className={`relative flex flex-col items-center gap-1 text-[10px] cursor-pointer transition px-4 py-1.5 rounded-lg ${
              activeTab === "photos" ? "text-accent-fg font-bold" : "text-slate-400 hover:text-slate-200 font-semibold"
            }`}
          >
            {activeTab === "photos" && (
              <motion.div
                layoutId="activeMobileTab"
                className="absolute inset-0 bg-accent -z-10 [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px),0_8px)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <ImageIcon className="w-5 h-5 text-inherit" />
            <span>Photos</span>
          </button>

          <button
            onClick={() => setActiveTab("albums")}
            className={`relative flex flex-col items-center gap-1 text-[10px] cursor-pointer transition px-4 py-1.5 rounded-lg ${
              activeTab === "albums" ? "text-accent-fg font-bold" : "text-slate-400 hover:text-slate-200 font-semibold"
            }`}
          >
            {activeTab === "albums" && (
              <motion.div
                layoutId="activeMobileTab"
                className="absolute inset-0 bg-accent -z-10 [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px),0_8px)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Compass className="w-5 h-5 text-inherit" />
            <span>Albums</span>
          </button>

          <button
            onClick={() => setActiveTab("add")}
            className={`relative w-10 h-10 ${activeTab === 'add' ? 'bg-accent text-accent-fg' : 'bg-white text-black hover:text-accent-fg'} font-bold [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px),0_8px)] flex items-center justify-center -translate-y-4 shadow-lg hover:bg-accent cursor-pointer transition active:scale-90`}
          >
            {activeTab === "add" && <motion.div layoutId="activeMobileTab" className="absolute -inset-1 border-2 border-accent [clip-path:polygon(10px_0,calc(100%-10px)_0,100%_10px,100%_calc(100%-10px),calc(100%-10px)_100%,10px_100%,0_calc(100%-10px),0_10px)] z-0 pointer-events-none" />}
            <Plus className="w-5 h-5 text-inherit relative z-10" />
          </button>

          <button
            onClick={() => setActiveTab("magic")}
            className={`relative flex flex-col items-center gap-1 text-[10px] cursor-pointer transition px-4 py-1.5 rounded-lg ${
              activeTab === "magic" ? "text-accent-fg font-bold" : "text-slate-400 hover:text-slate-200 font-semibold"
            }`}
          >
            {activeTab === "magic" && (
              <motion.div
                layoutId="activeMobileTab"
                className="absolute inset-0 bg-accent -z-10 [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px),0_8px)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Sparkles className="w-5 h-5 text-inherit" />
            <span>AI Assist</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`relative flex flex-col items-center gap-1 text-[10px] cursor-pointer transition px-4 py-1.5 rounded-lg ${
              activeTab === "settings" ? "text-accent-fg font-bold" : "text-slate-400 hover:text-slate-200 font-semibold"
            }`}
          >
            {activeTab === "settings" && (
              <motion.div
                layoutId="activeMobileTab"
                className="absolute inset-0 bg-accent -z-10 [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px),0_8px)]"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <Settings className="w-5 h-5 text-inherit" />
            <span>Settings</span>
          </button>
        </nav>

      {/* SELECTION MODE ACTIONS BANNER */}
      <AnimatePresence>
        {isSelectionMode && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 w-[90%] max-w-lg select-none"
          >
            {/* Top Toggle Row */}
            <div className="bg-neutral-900 border border-white/20 shadow-xl rounded-sm px-4 py-2 flex justify-between items-center">
              <button 
                onClick={handleSelectAllToggle} 
                className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-widest cursor-pointer hover:opacity-80 transition"
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Square className="w-4 h-4 text-white/50" />
                )}
                <span className={isAllSelected ? "text-emerald-500 font-bold" : "text-white/70"}>Select All</span>
              </button>
              
              <button 
                onClick={() => {
                  setSelectedPhotos(new Set());
                  setIsSelectionMode(false);
                }}
                className="text-[10px] uppercase font-mono tracking-wider font-semibold text-white/50 hover:text-white cursor-pointer transition flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </div>
            
            {/* Main Action Banner */}
            <div className="bg-neutral-900 border border-white/20 shadow-2xl rounded-sm p-3 flex items-center gap-4 sm:gap-6">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-widest uppercase font-mono">{selectedPhotos.size}</span>
                <span className="text-[9px] uppercase font-mono text-white/50 tracking-wider">Selected</span>
              </div>
              
              <div className="w-px h-8 bg-white/10" />

              <div className="flex items-center gap-2 flex-1">
                <button 
                  onClick={handleBulkDownload}
                  disabled={selectedPhotos.size === 0}
                  className="flex flex-col items-center flex-1 py-1.5 hover:bg-white/5 rounded-sm transition cursor-pointer text-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4 mb-1" />
                  <span className="text-[10px] uppercase font-mono tracking-wider">Download</span>
                </button>

                <button 
                  onClick={handleBulkShare}
                  disabled={selectedPhotos.size === 0}
                  className="flex flex-col items-center flex-1 py-1.5 hover:bg-white/5 rounded-sm transition cursor-pointer text-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Share2 className="w-4 h-4 mb-1" />
                  <span className="text-[10px] uppercase font-mono tracking-wider">Share</span>
                </button>

                <button 
                  onClick={handleBulkDelete}
                  disabled={selectedPhotos.size === 0}
                  className="flex flex-col items-center flex-1 py-1.5 hover:bg-white/5 rounded-sm transition cursor-pointer text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash className="w-4 h-4 mb-1" />
                  <span className="text-[10px] uppercase font-mono tracking-wider">Delete</span>
                </button>

                <button 
                  onClick={() => setIsBulkMoveModalOpen(true)}
                  disabled={selectedPhotos.size === 0}
                  className="flex flex-col items-center flex-1 py-1.5 hover:bg-white/5 rounded-sm transition cursor-pointer text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bookmark className="w-4 h-4 mb-1" />
                  <span className="text-[10px] uppercase font-mono tracking-wider">Move</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BULK MOVE TARGET ALBUM MODAL */}
      <AnimatePresence>
        {isBulkMoveModalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#050505] border border-white/20 p-5 rounded-sm w-[320px] shadow-2xl flex flex-col gap-4"
            >
              <h3 className="font-serif italic text-white text-lg">Move to Album</h3>
              <p className="text-[10px] font-mono text-white/50 uppercase tracking-widest border-b border-white/10 pb-3">
                {selectedPhotos.size} items selected
              </p>

              <select
                value={bulkActionTargetAlbum}
                onChange={(e) => setBulkActionTargetAlbum(e.target.value)}
                className="bg-black text-xs text-accent font-sans border border-white/20 rounded-sm p-3 outline-none"
              >
                {albums.map((al) => (
                  <option key={al.id} value={al.id}>
                    {al.name}
                  </option>
                ))}
              </select>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setIsBulkMoveModalOpen(false)}
                  className="flex-1 py-2 text-[10px] font-mono tracking-wider uppercase bg-white/5 hover:bg-white/10 text-white rounded-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkMove}
                  className="flex-1 py-2 text-[10px] font-mono tracking-wider uppercase bg-accent text-accent-fg font-bold rounded-sm cursor-pointer hover:opacity-90 transition-opacity"
                >
                  Move Items
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX / DETAILS / FX FILTER CUSTOMIZER OVERLAY */}
      <AnimatePresence>
        {currentLightboxIndex !== null && filteredPhotos[currentLightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#020202]/98 backdrop-blur-md z-50 flex flex-col md:flex-row select-none"
            id="lightbox-container-modal"
          >
            
            {/* Left/Main portion: Media view & switcher */}
            <div className="flex-1 relative flex flex-col items-center justify-center p-4 bg-black group overflow-hidden">
              
              {/* Back navigation */}
              {!isFullscreen && (
              <button
                onClick={handleCloseLightbox}
                className="absolute top-4 left-4 p-2.5 bg-black/60 hover:bg-white/5 text-accent/80 hover:text-white rounded-full border border-white/10 cursor-pointer flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider transition duration-300 z-20"
              >
                <X className="w-4 h-4" />
                <span>Exit Gallery</span>
              </button>
              )}

              {/* Action indicators top right */}
              <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                <button
                  onClick={() => setIsSlideshowPlaying(!isSlideshowPlaying)}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                    isSlideshowPlaying
                      ? "bg-accent/10 border-accent/25 text-accent"
                      : "bg-black border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                  title={isSlideshowPlaying ? "Pause Slideshow" : "Play Slideshow"}
                >
                  {isSlideshowPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => toggleFavorite(filteredPhotos[currentLightboxIndex].id)}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center cursor-pointer transition-all ${
                    filteredPhotos[currentLightboxIndex].favorite
                      ? "bg-rose-500/10 border-rose-500/25 text-rose-400"
                      : "bg-black border-white/10 text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${filteredPhotos[currentLightboxIndex].favorite ? "fill-rose-500" : ""}`} />
                </button>

                {isFullscreen && (
                  <>
                    <button
                      onClick={handleZoomIn}
                      className="w-9 h-9 bg-black hover:bg-white/5 border border-white/10 text-white/50 hover:text-white rounded-full flex items-center justify-center cursor-pointer transition-all"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleZoomOut}
                      className="w-9 h-9 bg-black hover:bg-white/5 border border-white/10 text-white/50 hover:text-white rounded-full flex items-center justify-center cursor-pointer transition-all"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}

                <button
                  onClick={() => setIsCropping(true)}
                  className="w-9 h-9 bg-black hover:bg-white/5 border border-white/10 text-white/50 hover:text-white rounded-full flex items-center justify-center cursor-pointer transition-all"
                  title="Crop Image"
                >
                  <Crop className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDownloadPhoto(filteredPhotos[currentLightboxIndex])}
                  className="w-9 h-9 bg-black hover:bg-white/5 border border-white/10 text-white/50 hover:text-white rounded-full flex items-center justify-center cursor-pointer transition-all"
                  title="Download photo"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleSharePhoto(filteredPhotos[currentLightboxIndex])}
                  className="w-9 h-9 bg-black hover:bg-white/5 border border-white/10 text-white/50 hover:text-white rounded-full flex items-center justify-center cursor-pointer transition-all"
                  title="Share photo"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => {
                     const elem = document.getElementById('lightbox-container-modal');
                     if (elem) {
                       if (document.fullscreenElement) {
                         document.exitFullscreen();
                       } else {
                         elem.requestFullscreen().catch(err => {
                           console.log(`Error attempting to enable fullscreen: ${err.message}`);
                         });
                       }
                     }
                  }}
                  className="w-9 h-9 bg-black hover:bg-white/5 border border-white/10 text-white/50 hover:text-white rounded-full flex items-center justify-center cursor-pointer transition-all md:flex hidden"
                  title="Toggle Fullscreen"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDeletePhoto(filteredPhotos[currentLightboxIndex].id)}
                  className="w-9 h-9 bg-black hover:bg-rose-950/20 hover:border-rose-500/25 text-white/50 hover:text-rose-450 rounded-full border border-white/10 flex items-center justify-center cursor-pointer transition-all"
                  title="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* IMAGE ELEMENT with applicable style preset */}
              <div className="w-full max-h-[70%] md:max-h-[80%] flex items-center justify-center relative p-3 overflow-hidden">
                
                {/* Render sliding loading shimmer scanner over image when analyzing */}
                {isAnalyzing && (
                  <div className="absolute inset-x-3 top-3 bottom-3 rounded-sm overflow-hidden pointer-events-none z-10 border border-purple-500/25">
                    <motion.div
                      initial={{ y: "-100%" }}
                      animate={{ y: "100%" }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-full h-1 bg-purple-400 shadow-[0_0_15px_4px_rgba(168,85,247,0.7)]"
                    />
                  </div>
                )}

                <AnimatePresence mode="wait" custom={slideDirection}>
                  {isCropping ? (
                    <div className="absolute inset-x-3 top-3 bottom-12 rounded-3xl overflow-hidden z-30 border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                      <Cropper
                        image={filteredPhotos[currentLightboxIndex].url}
                        crop={crop}
                        zoom={cropZoom}
                        aspect={cropAspect}
                        onCropChange={setCrop}
                        onZoomChange={setCropZoom}
                        onCropComplete={onCropComplete}
                      />
                      
                      {/* Aspect Ratio Selector Presets */}
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/80 p-1 rounded-full border border-white/10 z-30 max-w-[90%] shadow-lg">
                        {[
                          { label: "Free", value: undefined },
                          { label: "1:1", value: 1 },
                          { label: "4:3", value: 4 / 3 },
                          { label: "16:9", value: 16 / 9 },
                        ].map((opt) => (
                          <button
                            key={opt.label || "free"}
                            type="button"
                            onClick={() => setCropAspect(opt.value)}
                            className={`px-3 py-1 text-[9px] font-mono uppercase tracking-wider rounded-full transition-all cursor-pointer ${
                              cropAspect === opt.value
                                ? "bg-accent text-black font-bold"
                                : "text-white/60 hover:text-white hover:bg-white/5"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Visual Zoom range control */}
                      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[80%] max-w-[260px] bg-black/80 px-4 py-2 rounded-full border border-white/10 flex items-center gap-3 z-30 shadow-lg">
                        <span className="text-[9px] font-mono text-white/50 uppercase tracking-wider select-none">Zoom</span>
                        <input
                          type="range"
                          min={1}
                          max={3}
                          step={0.1}
                          value={cropZoom}
                          onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                          className="flex-1 accent-accent bg-white/10 h-1 rounded-full cursor-pointer outline-none"
                        />
                        <span className="text-[9px] font-mono text-accent min-w-[24px] text-right">{cropZoom.toFixed(1)}x</span>
                      </div>

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30">
                        <button 
                          type="button"
                          onClick={() => setIsCropping(false)} 
                          className="px-4 py-1.5 bg-black/80 hover:bg-black text-white rounded-full text-[10px] font-semibold border border-white/10 uppercase tracking-widest cursor-pointer transition active:scale-95"
                        >
                          Cancel
                        </button>
                        <button 
                          type="button"
                          onClick={handleSaveCrop} 
                          className="px-4 py-1.5 bg-accent hover:bg-white text-black rounded-full text-[10px] font-bold border border-white/10 uppercase tracking-widest cursor-pointer transition active:scale-95"
                        >
                          Save Crop
                        </button>
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      key={filteredPhotos[currentLightboxIndex].id}
                      custom={slideDirection}
                      variants={{
                        enter: (d: number) => ({ opacity: 0, x: d === 1 ? 40 : d === -1 ? -40 : 0 }),
                        center: { opacity: 1, x: 0 },
                        exit: (d: number) => ({ opacity: 0, x: d === 1 ? -40 : d === -1 ? 40 : 0 })
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      style={{ willChange: "transform, opacity" }}
                      className={`max-w-full ${isFullscreen ? "max-h-screen" : "max-h-[460px] md:max-h-[520px]"} relative`}
                    >
                      <motion.img
                        src={filteredPhotos[currentLightboxIndex].url}
                        alt={filteredPhotos[currentLightboxIndex].title}
                        referrerPolicy="no-referrer"
                        animate={{ scale: lightboxZoom }}
                        transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                        drag
                        dragConstraints={{ left: -3000, right: 3000, top: -3000, bottom: 3000 }}
                        dragElastic={0}
                        className={`max-w-full h-full object-contain rounded-sm border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] cursor-grab active:cursor-grabbing ${
                          FILTER_PRESETS.find(f => f.id === filteredPhotos[currentLightboxIndex].filter)?.class || ""
                        }`}
                        id="lightbox-main-img"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Dynamic image slide pointers */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none select-none z-10">
                <button
                  onClick={handlePrevLightbox}
                  className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 text-white/60 hover:text-white rounded-full flex items-center justify-center cursor-pointer pointer-events-auto hover:bg-white/5 transition active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextLightbox}
                  className="w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 text-white/60 hover:text-white rounded-full flex items-center justify-center cursor-pointer pointer-events-auto hover:bg-white/5 transition active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Slide counter */}
              {!isFullscreen && (
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black border border-white/10 px-3.5 py-1 rounded-full text-[9px] text-accent/60 font-mono tracking-widest">
                {currentLightboxIndex + 1} / {filteredPhotos.length}
              </span>
              )}
            </div>

            {/* Right portion: Metadata info, CSS filter adjustments, Exif specs, Gemini analyzer */}
            {!isFullscreen && (
            <div className="w-full md:w-80 bg-[#060606] border-t md:border-t-0 md:border-l border-white/10 p-5 flex flex-col gap-4 overflow-y-auto shrink-0 select-text">
              {/* Tab Selector */}
              <div className="flex bg-black border border-white/10 rounded-sm p-1 gap-1">
                <button
                  onClick={() => setLightboxTab("details")}
                  className={`flex-1 py-1.5 text-[9px] uppercase tracking-widest font-mono rounded-sm transition-colors ${
                    lightboxTab === "details" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setLightboxTab("exif")}
                  className={`flex-1 py-1.5 text-[9px] uppercase tracking-widest font-mono rounded-sm transition-colors ${
                    lightboxTab === "exif" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  EXIF Specs
                </button>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-4">
                {lightboxTab === "details" ? (
                  <>
                    {/* Photo title and Location */}
              {!isEditingMeta ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif italic text-white text-lg tracking-wide leading-snug">
                      {filteredPhotos[currentLightboxIndex].title}
                    </h3>
                    <button
                      onClick={() => {
                        setIsEditingMeta(true);
                        setEditTitle(filteredPhotos[currentLightboxIndex].title);
                        setEditLocation(filteredPhotos[currentLightboxIndex].location);
                        setEditTags(filteredPhotos[currentLightboxIndex].tags.join(", "));
                      }}
                      className="p-1.5 text-white/40 hover:text-white bg-black rounded-full cursor-pointer border border-white/10 hover:border-white/20 transition shrink-0"
                      title="Edit labels"
                    >
                      <Edit2 className="w-3 h-3 text-inherit" />
                    </button>
                  </div>
                  <p className="text-[11px] text-accent/60 uppercase tracking-widest flex items-center gap-1.5 font-mono mt-2">
                    <MapPin className="w-3.5 h-3.5 text-white/30 shrink-0" />
                    {filteredPhotos[currentLightboxIndex].location}
                  </p>
                </div>
              ) : (
                <div className="bg-black p-4 rounded-sm border border-white/10 flex flex-col gap-3">
                  <span className="text-[9px] font-mono tracking-widest text-accent/50 uppercase">Modify Specs</span>
                  <div>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 text-xs py-2 px-2.5 rounded-sm text-accent font-sans focus:border-accent/40 outline-none"
                      placeholder="Title"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 text-xs py-2 px-2.5 rounded-sm text-accent font-sans focus:border-accent/40 outline-none"
                      placeholder="Location"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 text-xs py-2 px-2.5 rounded-sm text-accent font-sans focus:border-accent/40 outline-none"
                      placeholder="Tags (separated by comma)"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() => handleSaveMeta(filteredPhotos[currentLightboxIndex].id)}
                      className="flex-1 bg-white hover:bg-accent text-black font-semibold py-2 rounded-full text-[10px] uppercase tracking-wider cursor-pointer transition"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditingMeta(false)}
                      className="px-2.5 py-2 text-white/40 hover:text-white text-[10px] font-mono uppercase tracking-wider transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Photo physical attributes specs */}
              <div className="grid grid-cols-2 gap-2 text-[10px] bg-black p-3.5 rounded-sm border border-white/10 select-none font-mono tracking-wide uppercase text-white/45">
                <div className="flex items-center gap-1.5 text-inherit">
                  <Calendar className="w-3.5 h-3.5 text-white/25" />
                  <span>{filteredPhotos[currentLightboxIndex].date}</span>
                </div>
                <div className="text-right text-inherit font-mono">
                  <span>Size: {filteredPhotos[currentLightboxIndex].size}</span>
                </div>
              </div>

              {/* Dynamic CSS filter FX preset picker */}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-3.5 select-none">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-inherit" /> Physical FX Engine
                </span>
                
                <div className="grid grid-cols-4 gap-1.5">
                  {FILTER_PRESETS.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => applyPresetFilter(filteredPhotos[currentLightboxIndex].id, filter.id)}
                      className={`py-1.5 px-1 rounded-sm text-[10px] tracking-wide font-medium text-center leading-tight cursor-pointer truncate transition-all ${
                        filteredPhotos[currentLightboxIndex].filter === filter.id
                          ? "bg-white text-black font-extrabold"
                          : "bg-black border border-white/10 text-accent/60 hover:text-white hover:bg-white/5"
                      }`}
                      title={filter.name}
                    >
                      {filter.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => handleSaveFilter(filteredPhotos[currentLightboxIndex])}
                  className="mt-2 w-full py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-sm text-[10px] tracking-widest uppercase font-bold transition-all cursor-pointer"
                >
                  Save as New Image
                </button>
              </div>

              {/* TAGS DISPLAYER */}
              <div className="flex flex-col gap-1.5 border-t border-white/10 pt-3.5 select-none">
                <span className="text-[9px] font-mono text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                  <Tag className="w-3 h-3 text-white/30" /> Tag Index
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {filteredPhotos[currentLightboxIndex].tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[9px] font-mono text-accent/65 bg-black border border-white/10 px-2 py-0.5 rounded-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* INTEGRATIVE GEMINI AI MODULE */}
              <div className="flex flex-col gap-2 border-t border-white/10 pt-4 mt-auto">
                <span className="text-[9px] font-mono text-accent/60 tracking-widest uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-inherit" /> Smart AI Assist
                </span>

                {/* AI Error warnings */}
                {aiError && (
                  <div className="bg-rose-950/20 text-rose-400 border border-rose-500/25 p-2.5 rounded-sm text-[10px]">
                    {aiError}
                  </div>
                )}

                {/* Shimmer loading layout for AI response */}
                {isAnalyzing && (
                  <div className="flex flex-col gap-2 bg-black p-4 rounded-sm border border-purple-500/10 animate-pulse">
                    <div className="w-16 h-3 bg-purple-500/20 rounded-sm" />
                    <div className="w-full h-8 bg-purple-500/10 rounded-sm" />
                    <div className="w-32 h-6 bg-purple-500/10 rounded-sm mt-1" />
                  </div>
                )}

                {/* Completed AI Analysis output render */}
                {aiAnalysis && !isAnalyzing && (
                  <div className="bg-black border border-purple-500/20 p-4 rounded-sm flex flex-col gap-3">
                    <div>
                      <span className="text-[9px] bg-purple-500/10 text-purple-300 font-mono tracking-wide px-2 py-0.5 rounded-sm border border-purple-500/25">
                        Gemini Description
                      </span>
                      <p className="text-[11px] text-accent/80 leading-relaxed mt-2 italic">
                        "{aiAnalysis.description}"
                      </p>
                    </div>

                    {/* Dominant Color Palette */}
                    {aiAnalysis.palette && aiAnalysis.palette.length > 0 && (
                      <div className="border-t border-white/5 pt-2 flex flex-col gap-1.5">
                        <span className="text-[9px] font-serif italic text-accent/60">Dominant Palette:</span>
                        <div className="flex gap-1">
                          {aiAnalysis.palette.map((color, index) => (
                            <div 
                              key={index} 
                              className="w-5 h-5 rounded-sm border border-white/10 shadow-sm transition hover:scale-110 cursor-default"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Show suggested tags imports if positive count */}
                    {aiAnalysis.suggestedTags && aiAnalysis.suggestedTags.length > 0 && (
                      <div className="border-t border-white/5 pt-2 flex flex-col gap-1.5">
                        <span className="text-[9px] font-serif italic text-accent/60">Discover missing keywords:</span>
                        <div className="flex flex-wrap gap-1">
                          {aiAnalysis.suggestedTags.map((tag, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                importAITags(filteredPhotos[currentLightboxIndex].id, [tag]);
                              }}
                              className="text-[9px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-sm flex items-center gap-0.5 cursor-pointer hover:bg-purple-500/20 active:scale-95 transition"
                            >
                              +{tag.toLowerCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Creative Story portion */}
                    {aiAnalysis.story ? (
                      <div className="border-t border-white/5 pt-2 flex flex-col gap-1">
                        <span className="text-[9px] font-serif italic text-accent/60">AI Narrative Story:</span>
                        <p className="text-[10px] text-accent/80 leading-relaxed italic bg-[#050505] p-2.5 rounded-sm border border-white/5">
                          {aiAnalysis.story}
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => triggerGeminidAnalysis(filteredPhotos[currentLightboxIndex], "story")}
                        disabled={aiStoryLoading}
                        className="w-full border border-purple-500/25 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 font-mono uppercase tracking-widest py-2 rounded-sm text-[9px] flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-95 disabled:opacity-50"
                      >
                        {aiStoryLoading ? (
                          <>
                            <Loader className="w-3 h-3 text-purple-400 animate-spin" />
                            <span>Weaving story...</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                            <span>Weave Poetic AI Story</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* CTA launch AI assistant */}
                {!aiAnalysis && !isAnalyzing && (
                  <button
                    onClick={() => triggerGeminidAnalysis(filteredPhotos[currentLightboxIndex])}
                    className="w-full bg-white hover:bg-accent text-black font-semibold py-2.5 px-4 rounded-full text-[10px] font-mono uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer hover:shadow-lg transition active:scale-95 text-center mt-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-inherit" />
                    Analyze Image with AI
                  </button>
                )}
              </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                {isParsingExif ? (
                  <div className="flex flex-col items-center justify-center p-8 text-white/50">
                    <Loader className="w-5 h-5 animate-spin mb-3 text-white/40" />
                    <span className="text-[10px] font-mono tracking-widest uppercase">Parsing EXIF...</span>
                  </div>
                ) : exifData ? (
                  exifData.error ? (
                    <div className="bg-rose-950/20 text-rose-400 border border-rose-500/25 p-3.5 rounded-sm text-[10px] font-mono">
                      {exifData.error}
                    </div>
                  ) : Object.keys(exifData).length === 0 ? (
                    <div className="bg-black text-accent/60 p-4 rounded-sm border border-white/10 text-center text-[10px] font-mono tracking-wide uppercase">
                      No EXIF Data Found
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                       {Object.entries(exifData)
                        // Filter out large/unreadable data blobs
                        .filter(([k, v]) => typeof v !== 'object' && String(v).length < 100)
                        .map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-0.5 bg-black p-3.5 rounded-sm border border-white/10 select-text">
                            <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase break-all">
                              {key}
                            </span>
                            <span className="text-[11px] font-sans text-accent break-all">
                              {String(value)}
                            </span>
                          </div>
                      ))}
                    </div>
                  )
                ) : null}
              </div>
            )}
            </div>
            </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
