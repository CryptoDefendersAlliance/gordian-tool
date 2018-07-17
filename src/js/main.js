import * as neo4jApi from './neo4jApi';
import * as utils from './utils';

let _graphData = null;

$(() => {
    loadExchanges();
    $('#neo4j-address-search').submit(e => {
        e.preventDefault();
        const value = $('#neo4j-address-search').find('input').val();
        const isValid = isAddressValid(value);
        if (!isValid) return;
        loadTxsByAddress(value);
    });

    // Tooltips Initialization
    $('body').tooltip({
        selector: '[data-toggle="tooltip"]'
    });
});
function loadExchanges() {
    $.ajax({
        url: 'https://spreadsheets.google.com/feeds/list/1LdmxfHHcPO3YZuHKEuTxNPdoqP2BkK3Rqyg76rHEqH8/od6/public/values?alt=json-in-script&callback=loadExchanges',

        // The name of the callback parameter, as specified by the YQL service
        jsonp: 'callback',

        // Tell jQuery we're expecting JSONP
        dataType: 'jsonp',

        // Work with the response
        success(response) {
            debugger;
            console.log(response); // server response
        }
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
    const height = 500;

    const circleRadius = 30;
    // _graphData.nodes[0].fx = circleRadius;

    let svg = window.d3.select('#neo4j-graph')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .call(d3.zoom().on('zoom', () => {
            svg.attr('transform', d3.event.transform);
        }))
        .append('g');

    // link arrow
    // svg
    //     .append('svg:defs')
    //     .append('svg:marker')
    //     .attr('id', 'arrow')
    //     .attr('viewBox', '0 -5 10 10')
    //     .attr('refX', 52)
    //     .attr('refY', -2)
    //     .attr('markerWidth', 6)
    //     .attr('markerHeight', 6)
    //     .attr('orient', 'auto')
    //     .append('path')
    //     .attr('d', 'M0,-5L10,0L0,5')
    //     .style('fill', 'black');
    svg
        .append('svg:defs')
        .append('svg:pattern')
        .attr('id', 'binance-image')
        .attr('x', '0%')
        .attr('y', '0%')
        .attr('height', '100%')
        .attr('width', '100%')
        .attr('viewBox', '0 0 50 50')
        // .attr('patternUnits', 'userSpaceOnUse')
        .append('image')
        .attr('x', '0%')
        .attr('y', '0%')
        .attr('height', 50)
        .attr('width', 50)
        .attr('xlink:href', 'https://cdn.freebiesupply.com/logos/large/2x/binance-coin-logo-png-transparent.png');


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

            // node.fx = null;
            // node.fy = null;
        });

    function onNodeClick(d) {
        neo4jApi.loadTxsByAddress(d.id).then(txs => {
            const graphData = neo4jApi.convertTxsToGraphData(txs);
            mergeGraphData(graphData);
            updateSimulation();
        });
        if (d.id == '0xcb270ac07fbdb44c0ff886ac994cf2ea54b0130d')
            $('#modalExchangeInfo').modal('toggle');
    }

    function onNodeMouseOver() {
        // Use D3 to select element, change color and size
        d3.select(this)
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
        if (d.id == '0xcb270ac07fbdb44c0ff886ac994cf2ea54b0130d') return 'url(#binance-image)';
        if (d.id == initialAddress) return '#0A2A3B';
        return '#2298D6';
    }

    function getNodeText(d) {
        if (d.id == '0xcb270ac07fbdb44c0ff886ac994cf2ea54b0130d') return null;
        return d.id.substr(0, 8) + '..';
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
