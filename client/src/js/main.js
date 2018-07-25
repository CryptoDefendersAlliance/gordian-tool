/* eslint-disable prefer-reflect*/
import * as neo4jApi from './neo4jApi';
import * as utils from './utils';
import RedFlagImage from '../img/red-flag.png';

let _graphData = null;
let _exchanges = null;
let _blackList = null;
let _blackListNodes = [];

// TODO move to helpers
function isAddressBelongsToExchange(address) {
    const exchange = getExchangeByAddress(address);
    return Boolean(exchange);
}

function isAddressInBlackList(address) {
    return Boolean(_blackList.find(entry => entry.address == address));
}

function getExchangeByAddress(address) {
    return _exchanges.find(entry => entry.address == address);
}

function filterBlackListNodes(nodes) {
    return nodes.filter(node => isAddressInBlackList(node.id));
}

function filterExchangeNodes(nodes) {
    return nodes.filter(node => isAddressBelongsToExchange(node.id));
}

function showExchangeModal(address) {
    const exchange = getExchangeByAddress(address);
    const $modal = $('#modalExchangeInfo');
    $modal.modal('toggle');

    $modal.find('.exchange-wallet-name').text(`${exchange.description}`);
    $modal.find('.exchange-name').text(`${exchange.name}`);
    $modal.find('.exchange-wallet-address a').text(exchange.address).attr('href', `https://etherscan.io/address/${exchange.address}`);
    $modal.find('.exchange-image').attr('src', exchange.imageUrl);
    $modal.find('.exchange-contact-info-telegram a').text(exchange.telegramUrl).attr('href', exchange.telegramUrl);
    $modal.find('.exchange-contact-info-email a').text(exchange.email).attr('href', `mailto:${exchange.email}`);
    $modal.find('.exchange-contact-info-phone-number span').text(exchange.phoneNumber);
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
        // showExchangeModal('0xf73c3c65bde10bf26c2e1763104e609a41702efe');
        $('#neo4j-address-search').submit(e => {
            e.preventDefault();
            const value = $('#neo4j-address-search').find('input').val();
            const isValid = isAddressValid(value);
            if (!isValid) return;

            loadTxsByAddress(value.toLowerCase());
        });

        // Popover Initialization
        // $('body').popover({
        //     selector: '[data-toggle="popover"]'
        // });
    });
}

// TODO - move all the diffrernt file, feedApi.js or something like that
function convertExchangesFeedData(feed) {
    return feed.entry.map(entry => ({
        address: entry.gsx$address.$t.toLowerCase(),
        name: entry.gsx$name.$t,
        description: entry.gsx$description.$t,
        imageUrl: `https://storage.googleapis.com/gordian/images/exchanges/${entry.gsx$imagename.$t}`,
        telegramUrl: entry.gsx$telegramurl.$t,
        email: entry.gsx$email.$t,
        phoneNumber: entry.gsx$phonenumber.$t
    }));
}

function convertBlackListFeedData(feed) {
    return feed.entry.map(entry => ({
        address: entry.gsx$address.$t.toLowerCase(),
        name: entry.gsx$name.$t
    }));
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

function toggleLoading(idLoading, $el) {
    $el.toggleClass('loading', idLoading);
}

function loadTxsByAddress(address) {
    toggleLoading(true, $('main'));
    const $graphEl = $('#neo4j-graph');

    neo4jApi.loadTxsByAddress(address).then((txs => {
        toggleLoading(false, $('main'));
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

    const mainComtainer = window.d3.select('main').node();
    const width = mainComtainer.getBoundingClientRect().width;
    const height = mainComtainer.getBoundingClientRect().height;

    const circleRadius = 35;
    // _graphData.nodes[0].fx = circleRadius;

    const zoom = window.d3.zoom().on('zoom', onZoom);
    const svg = window.d3.select('#neo4j-graph')
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = svg.call(zoom).append('g');
    const defs = g.append('svg:defs');
    _exchanges.forEach(exchange => {
        defs
            .append('svg:pattern')
            .attr('id', `${exchange.name}-image`)
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
    let flagElements;
    let labelElements;

    // we use svg groups to logically group the elements together
    const linkGroup = g.append('g').attr('class', 'links');
    const nodeGroup = g.append('g').attr('class', 'nodes');
    const textGroup = g.append('g').attr('class', 'texts');
    const flagsGroup = g.append('g').attr('class', 'flags');
    const labelsGroup = g.append('g').attr('class', 'labels');

    // simulation setup with all forces
    const linkForce = window.d3
        .forceLink()
        .id(link => link.id)
        .strength(link => link.strength)
        .strength(0.05);

    const simulation = window.d3
        .forceSimulation()
        .force('link', linkForce)
        .force('charge', window.d3.forceManyBody().strength(-200))
        .force('center', window.d3.forceCenter(width / 2, height / 2))
        .force('collision', window.d3.forceCollide().radius(circleRadius));

    const dragDrop = window.d3.drag()
        .on('start', d => {
            d.fx = d.x;
            d.fy = d.y;
        })
        .on('drag', d => {
            simulation.alphaTarget(0.7).restart();
            d.fx = window.d3.event.x;
            d.fy = window.d3.event.y;
        })
        .on('end', d => {
            if (!window.d3.event.active)
                simulation.alphaTarget(0);

            d.fx = null;
            d.fy = null;
        });

    function onZoom() {
        g.attr('transform', window.d3.event.transform);
    }

    function zoomToNode(d) {
        const scale = 1;

        // normalize for width/height
        let newX = width / 2 - scale * d.x;
        let newY = height / 2 - scale * d.y;
        let transform = window.d3.zoomIdentity.scale(scale).translate(newX, newY);

        svg.transition().duration(750).call(zoom.transform, transform);
    }

    function onNodeClick(d) {
        zoomToNode(d);

        if (isAddressBelongsToExchange(d.id)) return showExchangeModal(d.id);

        neo4jApi.loadTxsByAddress(d.id).then(txs => {
            const graphData = neo4jApi.convertTxsToGraphData(txs);

            graphData.nodes = graphData.nodes.map(node => {
                node.x = d.x - 50;
                node.y = d.y - 50;
                return node;
            });

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
        window.d3.select(this)
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
        if (isAddressBelongsToExchange(d.id)) {
            const exchange = getExchangeByAddress(d.id);
            return `url(#${exchange.name}-image)`;
        }
        if (d.id == initialAddress) return '#E3C102';

        return '#627eea';
    }

    function getNodeText(d) {
        if (isAddressBelongsToExchange(d.id)) return '';
        return d.id.substr(0, 6) + '..';
    }

    function getNodeLabelText(d) {
        const exchange = getExchangeByAddress(d.id);
        return exchange.description;
    }

    function updateGraph() {
        // links
        linkElements = linkGroup.selectAll('path').data(_graphData.links, link => link.hash);
        linkElements.exit().remove();
        const linkEnter = linkElements
            .enter()
            .append('path')
            .attr('stroke-width', getLinkStrokeWidth)
            .attr('stroke', '#627eea')
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
            .attr('font-size', 14)
            .attr('fill', '#fff')
            .attr('alignment-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .style('pointer-events', 'none');

        textElements = textEnter.merge(textElements);

        // flags
        const blackListNodes = filterBlackListNodes(_graphData.nodes);
        flagElements = flagsGroup.selectAll('image').data(blackListNodes, node => node.id);
        flagElements.exit().remove();

        const flagEnter = flagElements
            .enter()
            .append('image')
            .attr('height', 32)
            .attr('width', 32)
            // .style('transform', 'translate(-50%, -50%)')
            .style('transform', `translate(8px, ${-8 - circleRadius}px)`)
            .attr('xlink:href', RedFlagImage)
            .style('pointer-events', 'none');

        flagElements = flagEnter.merge(flagElements);

        // labels
        const exchangeNodes = filterExchangeNodes(_graphData.nodes);
        labelElements = labelsGroup.selectAll('g').data(exchangeNodes, node => node.id);
        labelElements.exit().remove();

        const labelEnter = labelElements
            .enter()
            .append('g')
            .attr('class', 'label-container');

        labelEnter
            .append('rect')
            .style('fill', '#3c3c3c')
            .attr('width', '120')
            .attr('height', '24')
            .attr('x', '-60')
            .attr('y', '-12')
            .attr('rx', '8')
            .attr('ry', '8');

        labelEnter
            .append('text')
            .attr('font-size', 12)
            .attr('alignment-baseline', 'middle')
            .attr('text-anchor', 'middle')
            .text(getNodeLabelText)
            .attr('fill', '#fff');

        labelElements = labelEnter.merge(labelElements);
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
            flagElements.attr('x', node => node.x).attr('y', node => node.y);
            labelElements.attr('transform', d => `translate(${d.x},${d.y - circleRadius - 20})`);
        });

        simulation.force('link').links(_graphData.links);
        simulation.alpha(0.7).restart();
        // simulation.alphaTarget(0.7).restart();
    }

    // last but not least, we call updateSimulation
    // to trigger the initial render
    updateSimulation();
}
