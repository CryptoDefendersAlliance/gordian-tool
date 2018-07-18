/* eslint-disable prefer-reflect*/
import * as neo4jApi from './neo4jApi';
import * as utils from './utils';

let _graphData = null;
let _exchanges = null;
let _blackList = null;

// TODO move to helpers
function isAddressBelongsToExchange(address) {
    return Boolean(_exchanges.find(entry => entry.address == address));
}

function isAddressBlackListed(address) {
    return Boolean(_blackList.find(entry => entry.address == address));
}

const tasks = [
    loadExchanges(),
    loadBlacklist()
];

Promise.all(tasks).then(values => {
    init();
});

function init() {
    $(() => {
        $('#neo4j-address-search').submit(e => {
            e.preventDefault();
            const value = $('#neo4j-address-search').find('input').val();
            const isValid = isAddressValid(value);
            if (!isValid) return;

            loadTxsByAddress(value.toLowerCase());
        });

        // Tooltips Initialization
        $('body').tooltip({
            selector: '[data-toggle="tooltip"]'
        });
    });
}

// TODO - move all the diffrernt file, feedApi.js or something like that
function convertExchangesFeedData(feed) {
    return feed.entry.map(entry => ({
        address: entry.gsx$address.$t.toLowerCase(),
        name: entry.gsx$name.$t,
        imageUrl: `https://storage.googleapis.com/gordian/images/exchanges/${entry.gsx$imagename.$t}`
    }));
}

function convertBlackListFeedData(feed) {
    return feed.entry.map(entry => ({
        address: entry.gsx$address.$t.toLowerCase(),
        name: entry.gsx$name.$t
    }));
}

// turns names like EtherDeltaCrowdsale or etherdelta_2 into plain etherdelta
function normalizeExchangeName() {

}

function loadExchanges() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: 'https://spreadsheets.google.com/feeds/list/1LdmxfHHcPO3YZuHKEuTxNPdoqP2BkK3Rqyg76rHEqH8/od6/public/values?alt=json-in-script',

            dataType: 'jsonp',
            success(response) {
                _exchanges = convertExchangesFeedData(response.feed);
                console.log('_exchanges', _exchanges);
                resolve(_exchanges);
            }
        });
    });
}

function loadBlacklist() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: 'https://spreadsheets.google.com/feeds/list/1DsH9LBWsymJNKFAI7O2d1RFc1dP1Ve4dsVnm09ogTjU/od6/public/values?alt=json-in-script',

            dataType: 'jsonp',
            success(response) {
                _blackList = convertBlackListFeedData(response.feed);
                console.log('_blackList', _blackList);
                resolve(_blackList);
            }
        });
    });
}

function isAddressValid(address) {
    if (!address || address.length !== 42) return false;
    if (address.substr(0, 2) !== '0x') return false;

    return true;
}

function loadTxsByAddress(address) {
    const $graphEl = $('#neo4j-graph');
    $graphEl.html('Loading..').addClass('active');

    neo4jApi.loadTxsByAddress(address).then((txs => {
        $graphEl.html('');
        _graphData = neo4jApi.convertTxsToGraphData(txs);
        renderGraph(address);
    }));
}


function mergeGraphData(newGraphData) {
    utils.mergeLists(_graphData.nodes, newGraphData.nodes, (a, b) => b.id === a.id);
    utils.mergeLists(_graphData.links, newGraphData.links, (a, b) => b.hash === a.hash);
}

function renderGraph(address) {
    const initialAddress = address;
    const width = 1200;
    const height = 600;
    const circleRadius = 30;
    let currentScale = 1;
    // _graphData.nodes[0].fx = circleRadius;

    const zoom = window.d3.zoom().on('zoom', onZoom);
    const svg = window.d3.select('#neo4j-graph')
        .append('svg')
        .attr('width', '100%')
        .attr('height', height)
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .call(zoom)
        .append('g');

    _exchanges.forEach(exchange => {
        svg
            .append('svg:defs')
            .append('svg:pattern')
            .attr('id', 'binance-image')
            .attr('x', '0%')
            .attr('y', '0%')
            .attr('height', '100%')
            .attr('width', '100%')
            .attr('viewBox', '0 0 50 50')
            .append('image')
            .attr('x', '0%')
            .attr('y', '0%')
            .attr('height', 50)
            .attr('width', 50)
            .attr('xlink:href', exchange.imageUrl);
    });

    let linkElements;
    let nodeElements;
    let textElements;

    // we use svg groups to logically group the elements together
    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');
    const textGroup = svg.append('g').attr('class', 'texts');

    // simulation setup with all forces
    const linkForce = d3
        .forceLink()
        .id(link => link.id)
        .strength(link => link.strength)
        .strength(0.1);

    const simulation = d3
        .forceSimulation()
        .force('link', linkForce)
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => d.radius));

    const dragDrop = d3.drag()
        .on('start', node => {
            node.fx = node.x;
            node.fy = node.y;
        })
        .on('drag', d => {
            simulation.alphaTarget(0.7).restart();
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        })
        .on('end', node => {
            if (!d3.event.active)
                simulation.alphaTarget(0);

            node.fx = null;
            node.fy = null;
        });

    function onZoom() {
        svg.attr('transform', window.d3.event.transform);
    }

    function centerToNode(d) {
        const scale = 1;

        // normalize for width/height
        let newX = width / 2 - scale * d.x;
        let newY = height / 2 - scale * d.y;

        let transform = window.d3.zoomIdentity.scale(scale).translate(newX, newY);

        svg.transition().duration(1000).call(zoom.transform, transform);
    }

    function onNodeClick(d) {
        centerToNode(d);
        if (isAddressBelongsToExchange(d.id)) return $('#modalExchangeInfo').modal('toggle');

        neo4jApi.loadTxsByAddress(d.id).then(txs => {
            const graphData = neo4jApi.convertTxsToGraphData(txs);
            mergeGraphData(graphData);
            updateSimulation();
        });
    }

    function onNodeMouseOver() {
        // Use D3 to select element, change color and size
        window.d3.select(this)
            .transition() // apply a transition
            .duration(300)
            .attr('r', circleRadius + 4);
        // .attr('stroke-width', 6);
    }

    function onNodeMouseOut() {
        // Use D3 to select element, change color and size
        d3.select(this)
            .transition()
            .duration(300)
            .attr('r', circleRadius);
        // .attr('stroke-width', 4);
    }

    function getLinkStrokeWidth(d) {
        const value = Math.sqrt(d.value);
        if (value < 0.5) return 0.5;
        if (value > 15) return 15;

        return value;
    }

    function getNodeFill(d) {
        if (isAddressBlackListed(d.id)) return '#D11515';
        if (isAddressBelongsToExchange(d.id)) return 'url(#binance-image)';
        if (d.id == initialAddress) return '#0A2A3B';

        return '#2298D6';
    }

    function getNodeText(d) {
        if (isAddressBelongsToExchange(d.id)) return null;
        return d.id.substr(0, 9) + '..';
    }

    function updateGraph() {
        // links
        linkElements = linkGroup.selectAll('path').data(_graphData.links, link => link.hash);
        linkElements.exit().remove();
        const linkEnter = linkElements
            .enter()
            .append('path')
            .attr('stroke-width', getLinkStrokeWidth)
            .attr('stroke', '#B5E0F7')
            .attr('fill', 'none');
        // .attr('marker-end', 'url(#arrow)'); // append arraow to the line

        linkElements = linkEnter.merge(linkElements);

        // nodes
        nodeElements = nodeGroup.selectAll('circle').data(_graphData.nodes, node => node.id);
        nodeElements.exit().remove();

        const nodeEnter = nodeElements
            .enter()
            .append('circle')
            .attr('r', circleRadius) // TODO move to param - to sync with arrow
            .attr('fill', getNodeFill)
            // .attr('stroke', '#dbdbdb')
            // .attr('stroke-width', 4)
            .call(dragDrop)
            .on('click', onNodeClick)
            .on('mouseover', onNodeMouseOver)
            .on('mouseout', onNodeMouseOut);

        nodeElements = nodeEnter.merge(nodeElements);

        // texts
        textElements = textGroup.selectAll('text').data(_graphData.nodes, node => node.id);
        textElements.exit().remove();

        const textEnter = textElements
            .enter()
            .append('text')
            .text(getNodeText)
            .attr('font-size', 9)
            .attr('fill', '#fff')
            .attr('dx', -21)
            .attr('dy', 2)
            .style('pointer-events', 'none');

        textElements = textEnter.merge(textElements);
    }

    function linkArc(d) {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy);
        return 'M' + d.source.x + ',' + d.source.y + 'A' + dr + ',' + dr + ' 0 0,1 ' + d.target.x + ',' + d.target.y;
    }

    function updateSimulation() {
        updateGraph();

        simulation.nodes(_graphData.nodes).on('tick', () => {
            nodeElements.attr('cx', node => node.x).attr('cy', node => node.y);
            textElements.attr('x', node => node.x).attr('y', node => node.y);
            linkElements.attr('d', linkArc);
        });

        simulation.force('link').links(_graphData.links);
        simulation.restart();
    }

    // last but not least, we call updateSimulation
    // to trigger the initial render
    updateSimulation();
}
