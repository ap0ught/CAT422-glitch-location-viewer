// Builds the layer list the viewer paints, and the optional platform list.
//
// Scenery is served only as img/scenery/<name>.png. Flash/SWF files are not
// requested. A missing PNG or other piece left out so the room can render is
// returned on the layer manifest as `dropped`, and the layer is still created.
//
// Horizontal placement matches the original client
// (LocationRenderer.recomputeParallax): at scroll percent p
// (0 at the near edge of the room, 1 at the far edge) a layer shifts by
// Math.floor(p * (viewport - layerSpan)). The middleground uses the same
// shift here because this viewer scrolls each layer instead of a camera
// rectangle.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.roomLayers = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    function asNumber(value) {
        var n = Number(value);
        return isFinite(n) ? n : null;
    }

    // Middleground decorations are in room coordinates. Canvas (0, 0) is
    // the room's top-left, which is (-l, -t) over from the world origin.
    function worldOrigin(dynamic) {
        var x = dynamic ? -Number(dynamic.l) : NaN;
        var y = dynamic ? -Number(dynamic.t) : NaN;
        return {
            x: isFinite(x) ? x : 0,
            y: isFinite(y) ? y : 0
        };
    }

    function sceneryUrl(filename) {
        if (typeof filename !== 'string') return null;
        var name = filename.replace(/^\s+|\s+$/g, '');
        if (!name || /\.swf$/i.test(name)) return null;
        return 'img/scenery/' + name.replace(/\.(png|jpe?g|gif)$/i, '') + '.png';
    }

    // A piece left out so the rest of the room can still be painted.
    // url is the PNG that was requested, or null when no PNG is served (Flash).
    function droppedPiece(layerId, filename, reason) {
        var name = typeof filename === 'string' ? filename.replace(/^\s+|\s+$/g, '') : '';
        return {
            layerId: layerId,
            filename: name,
            reason: reason,
            url: sceneryUrl(name)
        };
    }

    // The manifest keeps one entry per decoration. The on-page report groups
    // repeats so a street that reuses one missing file does not paint hundreds
    // of identical lines.
    function summarizeDropped(dropped) {
        var groups = [];
        var index = {};
        var list = dropped || [];
        for (var i = 0; i < list.length; i++) {
            var drop = list[i] || {};
            var filename = drop.filename || '';
            var reason = drop.reason || '';
            var url = drop.url || '';
            var key = filename + '\n' + reason + '\n' + url;
            if (Object.prototype.hasOwnProperty.call(index, key)) {
                groups[index[key]].count++;
            } else {
                index[key] = groups.length;
                groups.push({
                    filename: filename,
                    reason: reason,
                    url: drop.url || null,
                    count: 1
                });
            }
        }
        return groups;
    }

    function cameraPercent(focus, roomSpan, viewport) {
        focus = Number(focus);
        roomSpan = Number(roomSpan);
        viewport = Number(viewport);
        if (!isFinite(focus) || !isFinite(roomSpan) || !isFinite(viewport)) return 0;
        if (!(roomSpan > viewport)) return 0;
        var offset = focus - (viewport / 2);
        if (offset < 0) offset = 0;
        var maxOffset = roomSpan - viewport;
        if (offset > maxOffset) offset = maxOffset;
        return offset / maxOffset;
    }

    function layerTranslate(layerSpan, percent, viewport) {
        layerSpan = Number(layerSpan);
        percent = Number(percent);
        viewport = Number(viewport);
        if (!isFinite(layerSpan) || !isFinite(percent) || !isFinite(viewport)) return 0;
        var shift = Math.floor(percent * (viewport - layerSpan));
        return shift === 0 ? 0 : shift;
    }

    // null means every layer. An object means only those ids are painted.
    // `?layers=middleground` or `?displayLayers=middleground,sky`.
    function requestedLayerIds(search) {
        if (typeof search !== 'string') return null;
        var match = /(?:^|[?&])layers=([^&]*)/.exec(search) ||
            /(?:^|[?&])displayLayers=([^&]*)/.exec(search);
        if (!match) return null;
        var ids = {};
        var raw = match[1];
        try {
            raw = decodeURIComponent(raw.replace(/\+/g, ' '));
        } catch (e) {
            raw = match[1];
        }
        var parts = raw.split(',');
        for (var i = 0; i < parts.length; i++) {
            var id = parts[i].replace(/^\s+|\s+$/g, '');
            if (id) ids[id] = true;
        }
        return ids;
    }

    function layerIsRequested(requested, id) {
        return requested == null || requested[id] === true;
    }

    function layerManifest(room, roomId, dropped, requested) {
        var dynamic = (room && room.dynamic) || {};
        var source = dynamic.layers || {};
        var drops = dropped || [];
        var layers = [];
        var notFound = [];
        if (requested) {
            for (var asked in requested) {
                if (Object.prototype.hasOwnProperty.call(requested, asked) && !Object.prototype.hasOwnProperty.call(source, asked)) {
                    notFound.push(asked);
                }
            }
        }
        for (var id in source) {
            if (!Object.prototype.hasOwnProperty.call(source, id)) continue;
            var layer = source[id] || {};
            var z = asNumber(layer.z);
            var w = asNumber(layer.w);
            var h = asNumber(layer.h);
            var askedFor = layerIsRequested(requested, id);
            var sized = w !== null && h !== null;
            var painted = askedFor && sized;
            var layerDrops = [];
            for (var i = 0; i < drops.length; i++) {
                if (drops[i] && drops[i].layerId === id) layerDrops.push(drops[i]);
            }
            var entry = {
                id: id,
                name: layer.name || id,
                z: z === null ? 0 : z,
                w: w,
                h: h,
                gameplay: id === 'middleground',
                painted: painted,
                canvasId: painted ? id + '_canvas' : null,
                decoCount: (layer.decos && layer.decos.length) || layer.decoCount || 0,
                dropped: layerDrops
            };
            if (!painted) entry.omitReason = askedFor ? 'unpainted-layer' : 'not-requested';
            layers.push(entry);
        }
        layers.sort(function (a, b) {
            if (a.z !== b.z) return a.z - b.z;
            if (a.id < b.id) return -1;
            if (a.id > b.id) return 1;
            return 0;
        });
        return {
            schemaVersion: 1,
            roomId: roomId,
            label: room && room.label,
            bounds: { l: dynamic.l, r: dynamic.r, t: dynamic.t, b: dynamic.b },
            parallax: {
                percent: '0 at the near edge of the room, 1 at the far edge',
                translate: 'Math.floor(percent * (viewport - layerSpan))'
            },
            layers: layers,
            dropped: drops,
            notFound: notFound
        };
    }

    function endpoint(endpoints, name) {
        if (!endpoints) return null;
        for (var i = 0; i < endpoints.length; i++) {
            if (endpoints[i] && endpoints[i].name === name) return endpoints[i];
        }
        return null;
    }

    function platformLocations(room, roomId) {
        var dynamic = (room && room.dynamic) || {};
        var source = dynamic.layers || {};
        var lines = [];
        for (var layerId in source) {
            if (!Object.prototype.hasOwnProperty.call(source, layerId)) continue;
            var list = (source[layerId] && source[layerId].platformLines) || [];
            for (var i = 0; i < list.length; i++) {
                var line = list[i];
                lines.push({
                    id: line.id,
                    layerId: layerId,
                    start: endpoint(line.endpoints, 'start'),
                    end: endpoint(line.endpoints, 'end'),
                    itemPermission: line.platform_item_perm,
                    playerPermission: line.platform_pc_perm
                });
            }
        }
        return {
            schemaVersion: 1,
            roomId: roomId,
            label: room && room.label,
            coordinateSystem: 'Original Glitch world coordinates (x,y), not canvas pixels',
            bounds: { l: dynamic.l, r: dynamic.r, t: dynamic.t, b: dynamic.b },
            lines: lines
        };
    }

    return {
        sceneryUrl: sceneryUrl,
        worldOrigin: worldOrigin,
        droppedPiece: droppedPiece,
        summarizeDropped: summarizeDropped,
        cameraPercent: cameraPercent,
        layerTranslate: layerTranslate,
        requestedLayerIds: requestedLayerIds,
        layerIsRequested: layerIsRequested,
        layerManifest: layerManifest,
        platformLocations: platformLocations
    };
}));
