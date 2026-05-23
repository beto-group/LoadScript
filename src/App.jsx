const { loadScript, loadMultiple, fetchAndCacheImage } = await dc.require(dc.resolvePath("LOAD SCRIPT/src/LoadScriptUpgrade.js"));

// --- DOM Traversal Utilities ---
function findNearestAncestorWithClass(element, className) {
  if (!element) return null;
  let current = element.parentNode;
  while (current) {
    if (current.classList && current.classList.contains(className)) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

function findDirectChildByClass(parent, className) {
  if (!parent) return null;
  for (const child of parent.children) {
    if (child.classList && child.classList.contains(className)) {
      return child;
    }
  }
  return null;
}

function LoadScriptDemo() {
  const [loadedLibraries, setLoadedLibraries] = dc.useState([]);
  const [error, setError] = dc.useState(null);
  const [customUrl, setCustomUrl] = dc.useState('');
  const [customGlobal, setCustomGlobal] = dc.useState('');
  const [customType, setCustomType] = dc.useState('script');
  const [expandedLibrary, setExpandedLibrary] = dc.useState(null);
  const [explorerPath, setExplorerPath] = dc.useState([]);
  const [isFullTab, setIsFullTab] = dc.useState(true);
  const [loadingLibrary, setLoadingLibrary] = dc.useState(null);
  const [loadingProgress, setLoadingProgress] = dc.useState('');
  const [cachedStatus, setCachedStatus] = dc.useState({});
  
  const containerRef = dc.useRef(null);
  const stateRefs = dc.useRef({}).current;
  const instanceId = dc.useRef(Math.random().toString(36).substr(2, 5)).current;
  const uniqueWrapperClass = `loadscript-fulltab-${instanceId}`;

  // Full-tab effect
  dc.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    if (isFullTab) {
      if (!container.parentNode) {
        setTimeout(() => setIsFullTab(true), 50);
        return;
      }
      
      const targetPaneContent = findNearestAncestorWithClass(container, 'workspace-leaf-content');
      if (!targetPaneContent) {
        setIsFullTab(false);
        return;
      }
      
      const contentWrapper = findDirectChildByClass(targetPaneContent, 'view-content') || targetPaneContent;
      stateRefs.originalParent = container.parentNode;
      stateRefs.placeholder = document.createElement('div');
      stateRefs.placeholder.style.display = 'none';
      container.parentNode.insertBefore(stateRefs.placeholder, container);
      
      const computedParentPosition = window.getComputedStyle(contentWrapper).position;
      stateRefs.parentPositionInfo = {
        element: contentWrapper,
        originalInlinePosition: contentWrapper.style.position
      };
      
      if (computedParentPosition === 'static') {
        contentWrapper.style.position = "relative";
      }
      
      contentWrapper.appendChild(container);
      Object.assign(container.style, {
        position: "absolute",
        top: "0px",
        left: "0px",
        width: "100%",
        height: "100%",
        zIndex: "9998",
        overflow: "auto"
      });
    }
    
    // Cleanup
    return () => {
      if (!stateRefs.originalParent) return;
      if (stateRefs.placeholder?.parentNode) {
        stateRefs.placeholder.parentNode.replaceChild(container, stateRefs.placeholder);
      } else {
        stateRefs.originalParent.appendChild(container);
      }
      if (stateRefs.parentPositionInfo?.element) {
        stateRefs.parentPositionInfo.element.style.position = stateRefs.parentPositionInfo.originalInlinePosition || '';
      }
      container.removeAttribute("style");
      Object.keys(stateRefs).forEach(key => stateRefs[key] = null);
    };
  }, [isFullTab]);

  // Predefined library presetsconst presets = {
    classic: [
      { name: 'Globe.gl', url: 'https://unpkg.com/globe.gl', global: 'Globe', type: 'script' },
      { name: 'Three.js', url: 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js', global: 'THREE', type: 'script' },
      { name: 'GSAP', url: 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js', global: 'gsap', type: 'script' },
      { name: 'Chart.js', url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js', global: 'Chart', type: 'script' },
      { name: 'D3.js', url: 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js', global: 'd3', type: 'script' },
    ],
    esm: [
      { name: 'Svelte Compiler', url: 'https://esm.sh/svelte@5/compiler?bundle', global: 'SvelteCompiler', type: 'module' },
      { name: 'Marked (Markdown)', url: 'https://esm.sh/marked@12.0.0', global: 'marked', type: 'module' },
      { name: 'Prettier', url: 'https://esm.sh/prettier@3.2.5/standalone', global: 'prettier', type: 'module' },
    ]
  };

  const analyzeLibrary = (lib, result) => {
    const info = {
      name: lib.name,
      url: lib.url,
      global: lib.global,
      type: lib.type,
      loaded: true,
      timestamp: new Date().toLocaleTimeString(),
      fullTimestamp: new Date().toLocaleString(),
      details: {},
      justLoaded: true // Flag for animation
    };

    try {
      if (lib.type === 'module' && result) {
        // ESM module analysis
        const exports = Object.keys(result);
        info.details = {
          exports: exports,
          exportCount: exports.length,
          functions: exports.filter(key => typeof result[key] === 'function'),
          objects: exports.filter(key => typeof result[key] === 'object' && result[key] !== null),
          constants: exports.filter(key => typeof result[key] !== 'function' && typeof result[key] !== 'object')
        };
      } else if (lib.type === 'script' && lib.global && window[lib.global]) {
        // Classic script analysis
        const globalObj = window[lib.global];
        const props = Object.keys(globalObj);
        info.details = {
          properties: props.slice(0, 20),
          propertyCount: props.length,
          type: typeof globalObj,
          isFunction: typeof globalObj === 'function',
          isObject: typeof globalObj === 'object',
          hasPrototype: !!(globalObj.prototype),
          constructor: globalObj.constructor?.name
        };
      }
    } catch (e) {
      info.details.error = e.message;
    }

    // Remove justLoaded flag after 3 seconds
    setTimeout(() => {
      setLoadedLibraries(prev => 
        prev.map(l => l.url === lib.url ? { ...l, justLoaded: false } : l)
      );
    }, 3000);

    return info;
  };

  const loadLibrary = async (lib) => {
    try {
      setError(null);
      setLoadingLibrary(lib.name);
      setLoadingProgress('Checking for existing library...');
      
      // Check if already loaded
      if (loadedLibraries.some(l => l.url === lib.url)) {
        setError(`${lib.name} is already loaded!`);
        setLoadingLibrary(null);
        setLoadingProgress('');
        return;
      }

      setLoadingProgress(`Fetching ${lib.type === 'module' ? 'ESM module' : 'script'} from CDN...`);
      
      // Add a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 300));

      const result = await loadScript(dc, lib.url, {
        type: lib.type,
        globalName: lib.global
      });

      setLoadingProgress('Analyzing library structure...');
      await new Promise(resolve => setTimeout(resolve, 200));

      const libraryInfo = analyzeLibrary(lib, result);
      setLoadedLibraries(prev => [...prev, libraryInfo]);
      
      setLoadingProgress('✓ Library loaded successfully!');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setLoadingLibrary(null);
      setLoadingProgress('');

    } catch (err) {
      setError(`Failed to load ${lib.name}: ${err.message}`);
      setLoadingLibrary(null);
      setLoadingProgress('');
    }
  };

  
  // Check which presets are already cached
  dc.useEffect(() => {
    const checkCache = async () => {
      const adapter = dc.app.vault.adapter;
      const cacheDir = dc.resolvePath("LOAD SCRIPT/data/cache/scripts");
      const statusObj = {};
      
      const allPresets = [...presets.classic, ...presets.esm];
      for (const lib of allPresets) {
        if (/^https?:\/\//.test(lib.url)) {
          const safeFilename = lib.url.replace(/^https?:\/\//, '').replace(/[\/\\?%*:|"<>]/g, '_') + '.js';
          const cachePath = `${cacheDir}/${safeFilename}`;
          if (await adapter.exists(cachePath)) {
            statusObj[lib.url] = true;
          }
        }
      }
      setCachedStatus(statusObj);
    };
    checkCache();
  }, [dc, presets.classic.length, presets.esm.length]);

  const loadCustomLibrary = async () => {
    if (!customUrl) {
      setError('Please enter a URL');
      return;
    }

    const customLib = {
      name: customGlobal || 'Custom Library',
      url: customUrl,
      global: customGlobal || undefined,
      type: customType
    };

    await loadLibrary(customLib);
  };

  const removeLibrary = (index) => {
    setLoadedLibraries(prev => prev.filter((_, i) => i !== index));
  };

  const toggleExplorer = (index) => {
    if (expandedLibrary === index) {
      setExpandedLibrary(null);
      setExplorerPath([]);
    } else {
      setExpandedLibrary(index);
      setExplorerPath([]);
    }
  };

  const getObjectAtPath = (lib, path) => {
    let obj;
    
    if (lib.type === 'module') {
      // For ESM modules, get the exports
      obj = window[lib.global];
    } else if (lib.type === 'script' && lib.global) {
      // For classic scripts, get the global
      obj = window[lib.global];
    } else {
      return null;
    }

    // Navigate the path
    for (const key of path) {
      if (obj && typeof obj === 'object') {
        obj = obj[key];
      } else {
        return null;
      }
    }

    return obj;
  };

  const exploreProperty = (key) => {
    setExplorerPath(prev => [...prev, key]);
  };

  const navigateBack = () => {
    setExplorerPath(prev => prev.slice(0, -1));
  };

  const analyzeValue = (value, key) => {
    const type = typeof value;
    const result = {
      key,
      type,
      value: null,
      isExpandable: false,
      preview: '',
      details: {}
    };

    if (value === null) {
      result.preview = 'null';
    } else if (value === undefined) {
      result.preview = 'undefined';
    } else if (type === 'function') {
      const funcStr = value.toString();
      const params = funcStr.match(/\(([^)]*)\)/)?.[1] || '';
      result.preview = `ƒ ${key}(${params})`;
      result.details.parameters = params;
      result.details.source = funcStr.length > 200 ? funcStr.slice(0, 200) + '...' : funcStr;
      result.isExpandable = Object.keys(value).length > 0;
    } else if (type === 'object') {
      if (Array.isArray(value)) {
        result.preview = `Array(${value.length})`;
        result.details.length = value.length;
        result.isExpandable = value.length > 0;
      } else {
        const keys = Object.keys(value);
        result.preview = `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
        result.details.keys = keys;
        result.details.keyCount = keys.length;
        result.isExpandable = keys.length > 0;
      }
      result.details.constructor = value.constructor?.name;
    } else if (type === 'string') {
      result.preview = value.length > 50 ? `"${value.slice(0, 50)}..."` : `"${value}"`;
      result.value = value;
    } else if (type === 'number' || type === 'boolean') {
      result.preview = String(value);
      result.value = value;
    } else {
      result.preview = String(value);
    }

    return result;
  };

  const LibraryExplorer = ({ lib, libIndex }) => {
    const currentObj = getObjectAtPath(lib, explorerPath);
    
    if (!currentObj) {
      return <div style={{ color: '#6b7280', padding: '10px' }}>Unable to access object</div>;
    }

    let properties = [];
    
    try {
      if (typeof currentObj === 'function') {
        // For functions, show their properties
        properties = Object.keys(currentObj);
      } else if (Array.isArray(currentObj)) {
        // For arrays, show indices and methods
        properties = Object.keys(currentObj).slice(0, 100); // Limit to first 100 items
      } else if (typeof currentObj === 'object') {
        // For objects, show properties
        properties = Object.keys(currentObj);
      }
    } catch (e) {
      return <div style={{ color: '#fca5a5' }}>Error reading properties: {e.message}</div>;
    }

    return (
      <div style={{ 
        backgroundColor: '#000000', 
        padding: '15px', 
        borderRadius: '6px',
        marginTop: '10px',
        border: '1px solid #2d2d2d',
        maxHeight: '400px',
        overflowY: 'auto'
      }}>
        {/* Breadcrumb Navigation */}
        <div style={{ 
          marginBottom: '15px', 
          paddingBottom: '10px', 
          borderBottom: '1px solid #2d2d2d',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          fontFamily: 'monospace'
        }}>
          <span style={{ color: '#a1a1aa', fontWeight: 'bold' }}>
            {lib.global || lib.name}
          </span>
          {explorerPath.map((segment, i) => (
            <span key={i}>
              <span style={{ color: '#6b7280' }}> → </span>
              <span 
                style={{ 
                  color: '#a1a1aa', 
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
                onClick={() => setExplorerPath(explorerPath.slice(0, i + 1))}
              >
                {segment}
              </span>
            </span>
          ))}
          {explorerPath.length > 0 && (
            <button 
              onClick={navigateBack} 
              style={{ 
                marginLeft: 'auto',
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#a1a1aa',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
          )}
        </div>

        {/* Object Type Info */}
        <div style={{ 
          fontSize: '12px', 
          color: '#9ca3af', 
          marginBottom: '10px',
          padding: '8px',
          backgroundColor: '#0a0a0a',
          borderRadius: '4px',
          border: '1px solid #1a1a1a'
        }}>
          <strong>Type:</strong> {typeof currentObj}
          {currentObj.constructor && ` (${currentObj.constructor.name})`}
          {Array.isArray(currentObj) && ` [${currentObj.length} items]`}
          {typeof currentObj === 'object' && !Array.isArray(currentObj) && ` {${properties.length} properties}`}
        </div>

        {/* Properties List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {properties.length === 0 ? (
            <div style={{ color: '#6b7280', fontStyle: 'italic', padding: '10px' }}>
              No properties to display
            </div>
          ) : (
            properties.map(key => {
              let value;
              try {
                value = currentObj[key];
              } catch (e) {
                return (
                  <div key={key} style={{ 
                    padding: '6px 8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#fca5a5'
                  }}>
                    {key}: [Error accessing]
                  </div>
                );
              }

              const analysis = analyzeValue(value, key);
              
              return (
                <div 
                  key={key} 
                  style={{ 
                    padding: '6px 8px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: analysis.isExpandable ? 'pointer' : 'default',
                    transition: 'background-color 0.1s',
                    border: '1px solid #1a1a1a'
                  }}
                  onMouseEnter={(e) => {
                    if (analysis.isExpandable) {
                      e.currentTarget.style.backgroundColor = '#1a1a1a';
                      e.currentTarget.style.borderColor = '#a1a1aa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#0a0a0a';
                    e.currentTarget.style.borderColor = '#1a1a1a';
                  }}
                  onClick={() => {
                    if (analysis.isExpandable) {
                      exploreProperty(key);
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {analysis.isExpandable && (
                      <span style={{ color: '#a1a1aa' }}>▶</span>
                    )}
                    <span style={{ color: '#60a5fa' }}>{key}:</span>
                    <span style={{ 
                      color: analysis.type === 'function' ? '#d4d4d8' : 
                             analysis.type === 'object' ? '#fb923c' : 
                             analysis.type === 'string' ? '#4ade80' : 
                             '#9ca3af'
                    }}>
                      {analysis.preview}
                    </span>
                  </div>
                  <span style={{ 
                    fontSize: '10px', 
                    color: '#6b7280',
                    backgroundColor: '#000000',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    border: '1px solid #1a1a1a'
                  }}>
                    {analysis.type}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const buttonStyle = {
    padding: '8px 16px',
    backgroundColor: '#1a1a1a',
    color: 'white',
    border: '1px solid #a1a1aa',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px',
    marginRight: '8px',
    marginBottom: '8px',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 10px rgba(161, 161, 170, 0.3)'
  };

  const smallButtonStyle = {
    ...buttonStyle,
    padding: '4px 12px',
    fontSize: '11px',
    backgroundColor: '#0a0a0a',
    border: '1px solid #3f3f46',
    boxShadow: '0 0 5px rgba(63, 63, 70, 0.2)'
  };

  const cardStyle = {
    backgroundColor: '#0a0a0a',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '12px',
    border: '1px solid #2d2d2d',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)'
  };

  const inputStyle = {
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #2d2d2d',
    backgroundColor: '#000000',
    color: 'white',
    fontSize: '13px',
    width: '100%',
    marginBottom: '8px',
    transition: 'border-color 0.2s ease'
  };

  const hoverEffectStyle = `
    .${uniqueWrapperClass} .subtle-icon {
      opacity: 0;
      transform: scale(0.9);
      transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
    }
    .${uniqueWrapperClass}:hover .subtle-icon {
      opacity: 0.7;
      transform: scale(1);
    }
    .${uniqueWrapperClass} .subtle-icon:hover {
      opacity: 1;
    }
    .${uniqueWrapperClass} .subtle-icon:hover .exit-tooltip {
      visibility: visible;
      opacity: 1;
    }
  `;

  const exitTooltipStyle = {
    visibility: 'hidden',
    opacity: 0,
    backgroundColor: '#1a1a1a',
    color: 'white',
    textAlign: 'center',
    borderRadius: '4px',
    padding: '5px 10px',
    position: 'absolute',
    zIndex: 1,
    top: '50%',
    right: '120%',
    transform: 'translateY(-50%)',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    border: '1px solid #a1a1aa',
    transition: 'opacity 0.2s ease-in-out'
  };

  const exitIconStyle = {
    position: 'absolute',
    top: '15px',
    right: '20px',
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#a1a1aa',
    userSelect: 'none',
    cursor: 'pointer',
    zIndex: 10
  };

  const compactWrapperStyle = {
    padding: '16px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    border: '1px dashed #2d2d2d',
    borderRadius: '8px',
    backgroundColor: '#0a0a0a'
  };

  const compactTextStyle = {
    margin: 0,
    color: '#9ca3af',
    fontSize: '14px'
  };

  const compactButtonStyle = {
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'white',
    backgroundColor: '#a1a1aa',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    boxShadow: '0 0 10px rgba(161, 161, 170, 0.3)',
    transition: 'all 0.2s ease'
  };

  // If not in full-tab mode, show compact view
  if (!isFullTab) {
    return (
      <div ref={containerRef} style={compactWrapperStyle}>
        <dc.Icon icon="package" style={{ fontSize: '48px', color: '#a1a1aa' }} />
        <p style={compactTextStyle}>LoadScript component in compact mode.</p>
        <button 
          style={compactButtonStyle} 
          onClick={() => setIsFullTab(true)}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#d4d4d8';
            e.target.style.boxShadow = '0 0 15px rgba(161, 161, 170, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#a1a1aa';
            e.target.style.boxShadow = '0 0 10px rgba(161, 161, 170, 0.3)';
          }}
        >
          <dc.Icon icon="maximize" style={{ fontSize: '14px', marginRight: '6px', verticalAlign: 'middle' }} />
          Enter Full Tab
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <style>{hoverEffectStyle}</style>
      <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', backgroundColor: '#000000', minHeight: '100vh', position: 'relative' }} className={uniqueWrapperClass}>
        {/* Exit Full Tab Icon */}
        <div 
          style={exitIconStyle} 
          className="subtle-icon" 
          onClick={() => setIsFullTab(false)}
        >
          <dc.Icon icon="minimize" style={{ fontSize: '18px' }} />
          <span className="exit-tooltip" style={exitTooltipStyle}>
            Exit Full Tab
          </span>
        </div>

        <h2 style={{ color: 'white', textShadow: '0 0 10px rgba(161, 161, 170, 0.5)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <dc.Icon icon="package" style={{ fontSize: '32px', color: '#a1a1aa' }} />
          LoadScript Upgrade - Library Manager
        </h2>
      <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
        Load and analyze classic scripts and ESM modules with caching
      </p>

      {/* Loading Indicator */}
      {loadingLibrary && (
        <div style={{
          ...cardStyle,
          backgroundColor: '#1a1a1a',
          border: '2px solid #a1a1aa',
          boxShadow: '0 0 20px rgba(161, 161, 170, 0.4)',
          marginBottom: '20px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.8; }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ 
              animation: 'spin 1s linear infinite',
              display: 'flex',
              alignItems: 'center'
            }}>
              <dc.Icon icon="loader" style={{ fontSize: '32px', color: '#a1a1aa' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: '0 0 8px 0', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <dc.Icon icon="download" style={{ fontSize: '20px', color: '#a1a1aa' }} />
                Loading {loadingLibrary}...
              </h3>
              <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px' }}>
                {loadingProgress}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ ...cardStyle, backgroundColor: '#1a0a0a', color: '#fca5a5', border: '1px solid #7f1d1d', marginBottom: '15px', display: 'flex', alignItems: 'start', gap: '10px' }}>
          <dc.Icon icon="alert-circle" style={{ fontSize: '20px', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong>Error:</strong> {error}
          </div>
          <button style={{ ...smallButtonStyle, float: 'right', backgroundColor: '#0a0a0a', padding: '2px 8px' }} onClick={() => setError(null)}>
            <dc.Icon icon="x" style={{ fontSize: '12px' }} />
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
        {/* Classic Scripts Presets */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: 'white', borderBottom: '1px solid #a1a1aa', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="scroll" style={{ fontSize: '20px', color: '#a1a1aa' }} />
            Classic Scripts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {presets.classic.map((lib, i) => (
              <button 
                key={i} 
                style={buttonStyle} 
                onClick={() => loadLibrary(lib)}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#27272a';
                  e.target.style.boxShadow = '0 0 15px rgba(161, 161, 170, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#1a1a1a';
                  e.target.style.boxShadow = '0 0 10px rgba(161, 161, 170, 0.3)';
                }}
              >
                <dc.Icon icon={cachedStatus[lib.url] ? "check-circle" : "download"} style={{ fontSize: '14px', marginRight: '6px', verticalAlign: 'middle', color: cachedStatus[lib.url] ? '#4ade80' : 'inherit' }} />
                {lib.name}
                {cachedStatus[lib.url] && <span style={{fontSize: '10px', marginLeft: '6px', color: '#4ade80'}}>(Cached)</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ESM Modules Presets */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: 'white', borderBottom: '1px solid #a1a1aa', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="package" style={{ fontSize: '20px', color: '#a1a1aa' }} />
            ESM Modules
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {presets.esm.map((lib, i) => (
              <button 
                key={i} 
                style={buttonStyle} 
                onClick={() => loadLibrary(lib)}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#27272a';
                  e.target.style.boxShadow = '0 0 15px rgba(161, 161, 170, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#1a1a1a';
                  e.target.style.boxShadow = '0 0 10px rgba(161, 161, 170, 0.3)';
                }}
              >
                <dc.Icon icon={cachedStatus[lib.url] ? "check-circle" : "download"} style={{ fontSize: '14px', marginRight: '6px', verticalAlign: 'middle', color: cachedStatus[lib.url] ? '#4ade80' : 'inherit' }} />
                {lib.name}
                {cachedStatus[lib.url] && <span style={{fontSize: '10px', marginLeft: '6px', color: '#4ade80'}}>(Cached)</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Library Loader */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: 'white', borderBottom: '1px solid #a1a1aa', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <dc.Icon icon="wrench" style={{ fontSize: '20px', color: '#a1a1aa' }} />
          Load Custom Library
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 120px', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="https://cdn.example.com/library.js"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = '#a1a1aa'}
            onBlur={(e) => e.target.style.borderColor = '#2d2d2d'}
          />
          <input
            type="text"
            placeholder="Global name (optional)"
            value={customGlobal}
            onChange={(e) => setCustomGlobal(e.target.value)}
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = '#a1a1aa'}
            onBlur={(e) => e.target.style.borderColor = '#2d2d2d'}
          />
          <select 
            value={customType} 
            onChange={(e) => setCustomType(e.target.value)} 
            style={inputStyle}
            onFocus={(e) => e.target.style.borderColor = '#a1a1aa'}
            onBlur={(e) => e.target.style.borderColor = '#2d2d2d'}
          >
            <option value="script">Classic</option>
            <option value="module">ESM</option>
          </select>
        </div>
        <button 
          style={buttonStyle} 
          onClick={loadCustomLibrary}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#2d1f3d';
            e.target.style.boxShadow = '0 0 15px rgba(161, 161, 170, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#1a1a1a';
            e.target.style.boxShadow = '0 0 10px rgba(161, 161, 170, 0.3)';
          }}
        >
          <dc.Icon icon="plus" style={{ fontSize: '14px', marginRight: '6px', verticalAlign: 'middle' }} />
          Load Custom
        </button>
      </div>

      {/* Loaded Libraries */}
      {loadedLibraries.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>� Loaded Libraries ({loadedLibraries.length})</h3>
          {loadedLibraries.map((lib, index) => (
            <div key={index} style={{
              backgroundColor: '#0f0f0f',
              padding: '15px',
              borderRadius: '6px',
              marginBottom: '10px',
              border: lib.justLoaded ? '2px solid #a1a1aa' : '1px solid #2d2d2d',
              boxShadow: lib.justLoaded 
                ? '0 0 20px rgba(161, 161, 170, 0.6), 0 4px 8px rgba(0, 0, 0, 0.5)' 
                : '0 2px 4px rgba(0, 0, 0, 0.5)',
              animation: lib.justLoaded ? 'slideIn 0.5s ease-out' : 'none',
              transition: 'all 0.3s ease'
            }}>
              <style>{`
                @keyframes slideIn {
                  from {
                    opacity: 0;
                    transform: translateY(-10px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}</style>
              {lib.justLoaded && (
                <div style={{
                  backgroundColor: '#2d1f3d',
                  color: '#d4d4d8',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid #a1a1aa'
                }}>
                  <dc.Icon icon="check-circle" style={{ fontSize: '14px' }} />
                  <strong>Just Loaded!</strong> • {lib.fullTimestamp}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0', color: '#d4d4d8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <dc.Icon icon={lib.type === 'module' ? 'package' : 'scroll'} style={{ fontSize: '18px' }} />
                    {lib.name}
                  </h4>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>
                    {lib.type === 'module' ? 'ESM Module' : 'Classic Script'} • {lib.timestamp}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    style={{
                      ...smallButtonStyle, 
                      backgroundColor: expandedLibrary === index ? '#2d1f3d' : '#0a0a0a',
                      border: expandedLibrary === index ? '1px solid #a1a1aa' : '1px solid #3f3f46'
                    }} 
                    onClick={() => toggleExplorer(index)}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#2d1f3d';
                      e.target.style.boxShadow = '0 0 10px rgba(161, 161, 170, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = expandedLibrary === index ? '#2d1f3d' : '#0a0a0a';
                      e.target.style.boxShadow = '0 0 5px rgba(63, 63, 70, 0.2)';
                    }}
                  >
                    <dc.Icon icon={expandedLibrary === index ? 'eye-off' : 'eye'} style={{ fontSize: '11px', marginRight: '4px', verticalAlign: 'middle' }} />
                    {expandedLibrary === index ? 'Hide Explorer' : 'Explore'}
                  </button>
                  <button 
                    style={smallButtonStyle} 
                    onClick={() => removeLibrary(index)}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#1a0a0a';
                      e.target.style.border = '1px solid #7f1d1d';
                      e.target.style.boxShadow = '0 0 10px rgba(127, 29, 29, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#0a0a0a';
                      e.target.style.border = '1px solid #3f3f46';
                      e.target.style.boxShadow = '0 0 5px rgba(63, 63, 70, 0.2)';
                    }}
                  >
                    <dc.Icon icon="trash-2" style={{ fontSize: '11px', marginRight: '4px', verticalAlign: 'middle' }} />
                    Remove
                  </button>
                </div>
              </div>

              {expandedLibrary !== index && (
                <div style={{ fontSize: '12px', fontFamily: 'monospace', backgroundColor: '#000000', padding: '10px', borderRadius: '4px', border: '1px solid #1a1a1a' }}>
                  <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <dc.Icon icon="link" style={{ fontSize: '12px', color: '#9ca3af' }} />
                    <strong style={{ color: '#9ca3af' }}>URL:</strong> 
                    <span style={{ color: '#a1a1aa', fontSize: '11px', wordBreak: 'break-all' }}>{lib.url}</span>
                  </div>
                  {lib.global && (
                    <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <dc.Icon icon="globe" style={{ fontSize: '12px', color: '#9ca3af' }} />
                      <strong style={{ color: '#9ca3af' }}>Global:</strong> 
                      <span style={{ color: '#4ade80' }}>window.{lib.global}</span>
                    </div>
                  )}
                  
                  {/* Quick Stats */}
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '8px', 
                    backgroundColor: '#0a0a0a', 
                    borderRadius: '4px',
                    border: '1px solid #1a1a1a',
                    display: 'flex',
                    gap: '15px',
                    flexWrap: 'wrap'
                  }}>
                    {lib.type === 'module' && lib.details.exports && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <dc.Icon icon="box" style={{ fontSize: '14px', color: '#60a5fa' }} />
                          <span style={{ color: '#9ca3af' }}>Exports: <strong style={{ color: 'white' }}>{lib.details.exportCount}</strong></span>
                        </div>
                        {lib.details.functions?.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <dc.Icon icon="function-square" style={{ fontSize: '14px', color: '#d4d4d8' }} />
                            <span style={{ color: '#9ca3af' }}>Functions: <strong style={{ color: 'white' }}>{lib.details.functions.length}</strong></span>
                          </div>
                        )}
                        {lib.details.objects?.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <dc.Icon icon="package" style={{ fontSize: '14px', color: '#fb923c' }} />
                            <span style={{ color: '#9ca3af' }}>Objects: <strong style={{ color: 'white' }}>{lib.details.objects.length}</strong></span>
                          </div>
                        )}
                      </>
                    )}
                    {lib.type === 'script' && lib.details.propertyCount && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <dc.Icon icon="list" style={{ fontSize: '14px', color: '#60a5fa' }} />
                        <span style={{ color: '#9ca3af' }}>Properties: <strong style={{ color: 'white' }}>{lib.details.propertyCount}</strong></span>
                      </div>
                    )}
                  </div>
                  
                  {lib.type === 'module' && lib.details.exports && (
                    <>
                      <div style={{ marginTop: '10px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <dc.Icon icon="layers" style={{ fontSize: '14px', color: '#a1a1aa' }} />
                        <strong style={{ color: '#9ca3af' }}>Detailed Exports:</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginLeft: '10px' }}>
                        {lib.details.functions?.length > 0 && (
                          <div>
                            <div style={{ color: '#60a5fa', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                              <dc.Icon icon="function-square" style={{ fontSize: '10px', marginRight: '4px' }} />
                              Functions ({lib.details.functions.length}):
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '11px' }}>
                              {lib.details.functions.join(', ')}
                            </div>
                          </div>
                        )}
                        {lib.details.objects?.length > 0 && (
                          <div>
                            <div style={{ color: '#fb923c', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                              <dc.Icon icon="package" style={{ fontSize: '10px', marginRight: '4px' }} />
                              Objects ({lib.details.objects.length}):
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '11px' }}>
                              {lib.details.objects.join(', ')}
                            </div>
                          </div>
                        )}
                        {lib.details.constants?.length > 0 && (
                          <div>
                            <div style={{ color: '#d4d4d8', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                              <dc.Icon icon="tag" style={{ fontSize: '10px', marginRight: '4px' }} />
                              Constants ({lib.details.constants.length}):
                            </div>
                            <div style={{ color: '#6b7280', fontSize: '11px' }}>
                              {lib.details.constants.join(', ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {lib.type === 'script' && lib.details.properties && (
                    <>
                      <div style={{ marginTop: '10px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <dc.Icon icon="info" style={{ fontSize: '14px', color: '#a1a1aa' }} />
                        <strong style={{ color: '#9ca3af' }}>Library Details:</strong>
                      </div>
                      <div style={{ marginLeft: '10px', color: '#6b7280', fontSize: '11px' }}>
                        {lib.details.type && <div style={{ marginBottom: '4px' }}>
                          <dc.Icon icon="code" style={{ fontSize: '10px', marginRight: '6px', color: '#60a5fa' }} />
                          Type: <strong style={{ color: 'white' }}>{lib.details.type}</strong>
                        </div>}
                        {lib.details.constructor && <div style={{ marginBottom: '4px' }}>
                          <dc.Icon icon="cpu" style={{ fontSize: '10px', marginRight: '6px', color: '#d4d4d8' }} />
                          Constructor: <strong style={{ color: 'white' }}>{lib.details.constructor}</strong>
                        </div>}
                        {lib.details.hasPrototype && <div style={{ marginBottom: '4px' }}>
                          <dc.Icon icon="check-circle" style={{ fontSize: '10px', marginRight: '6px', color: '#4ade80' }} />
                          Has Prototype: <strong style={{ color: 'white' }}>✓</strong>
                        </div>}
                        {lib.details.properties && (
                          <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#0a0a0a', borderRadius: '3px', border: '1px solid #2d2d2d' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                              <dc.Icon icon="list" style={{ fontSize: '12px', color: '#a1a1aa' }} />
                              <span style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 'bold' }}>
                                Properties ({lib.details.propertyCount} total)
                              </span>
                            </div>
                            <div style={{ 
                              color: '#d4d4d8', 
                              fontSize: '10px', 
                              lineHeight: '1.6',
                              maxHeight: '120px',
                              overflowY: 'auto',
                              padding: '4px',
                              backgroundColor: '#000000',
                              borderRadius: '2px'
                            }}>
                              {lib.details.properties.join(', ')}
                            </div>
                            {lib.details.propertyCount > 20 && (
                              <div style={{ marginTop: '4px', color: '#6b7280', fontSize: '9px', fontStyle: 'italic' }}>
                                <dc.Icon icon="alert-circle" style={{ fontSize: '9px', marginRight: '4px' }} />
                                Showing first 20 properties only. {lib.details.propertyCount - 20} more available.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {expandedLibrary === index && (
                <LibraryExplorer lib={lib} libIndex={index} />
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ ...cardStyle, backgroundColor: '#0a0a0a', border: '1px solid #a1a1aa' }}>
        <h4 style={{ color: 'white', marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <dc.Icon icon="sparkles" style={{ fontSize: '20px', color: '#a1a1aa' }} />
          Features
        </h4>
        <ul style={{ fontSize: '13px', color: '#9ca3af', margin: '10px 0', paddingLeft: '20px' }}>
          <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="check" style={{ fontSize: '14px', color: '#4ade80' }} />
            Classic script & ESM module support
          </li>
          <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="check" style={{ fontSize: '14px', color: '#4ade80' }} />
            Vault caching for offline access
          </li>
          <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="check" style={{ fontSize: '14px', color: '#4ade80' }} />
            Global deduplication (no duplicate loads)
          </li>
          <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="check" style={{ fontSize: '14px', color: '#4ade80' }} />
            Library analysis (exports, functions, properties)
          </li>
          <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="check" style={{ fontSize: '14px', color: '#4ade80' }} />
            Custom library loading
          </li>
          <li style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <dc.Icon icon="check" style={{ fontSize: '14px', color: '#4ade80' }} />
            Real-time library information
          </li>
        </ul>
      </div>
    </div>
    </div>
  );
}

return { App: LoadScriptDemo };