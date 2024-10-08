import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onSubmitModal,
    onGroupByUpdated,
    renderUpdatedStatsPie
}
let gUserPos
let gCrnLoc = {}
function onInit() {
    loadAndRenderLocs()
    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddLoc)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()
    var strHTML = locs.map(loc => {
        let locDistance = ''
        if (gUserPos) {
            const locLatLan = { lat: loc.geo.lat, lng: loc.geo.lng }
            locDistance = (`Distance: ${utilService.getDistance(locLatLan, gUserPos)} KLM`)
        }
        const className = (loc.id === selectedLocId) ? 'active' : ''
        // console.log(distanceHtml)
        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
                <span>${loc.name}</span>
                <span title="${loc.name}">${locDistance}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
            </p>
            <div class="loc-btns">     
               <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateLoc('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}

function onRemoveLoc(locId) {
    locService.remove(locId)
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(geo) {
    gCrnLoc.geo = geo
    const elModal = document.getElementById('update-modal')
    elModal.showModal()
    const elLocName = document.getElementById('Loc-name')
    const elLocRating = document.getElementById('Loc-rating')
    elLocName.value = (geo.address || 'Just a place')
    elLocRating.value = 3
}

function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {
    mapService.getUserPosition()
        .then(latLng => {
            gUserPos = latLng
            mapService.panTo({ ...latLng, zoom: 15 })
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}

function onUpdateLoc(locId) {
    locService.getById(locId)
        .then(loc => {
            const elModal = document.getElementById('update-modal')
            elModal.showModal()
            const elLocName = document.getElementById('Loc-name')
            const elLocRating = document.getElementById('Loc-rating')
            elLocName.value = loc.name
            elLocRating.value = loc.rate
            gCrnLoc.name = loc.name
            gCrnLoc.rate = loc.rate
            gCrnLoc.updatedAt = loc.updatedAt
            gCrnLoc.createdAt = loc.createdAt
            gCrnLoc.id = loc.id
            gCrnLoc.geo = loc.geo

            console.log(loc)
            console.log(gCrnLoc)

        })
}

function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {

    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)
    let locDistance
    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    if (gUserPos) {
        const locLatLan = { lat: loc.geo.lat, lng: loc.geo.lng }
        locDistance = `Distance: ${utilService.getDistance(locLatLan, gUserPos)} KLM`
        el.querySelector('.loc-distance').innerText = locDistance
    }
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked
    if (!prop) return
    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1
    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        console.log('stats:', stats)
        handleStats(stats, 'loc-stats-rate')
    })
}




function handleStats(stats, selector) {
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `

    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const elLegend = document.querySelector(`.${selector} .legend`)

    if (elPie) {
        elPie.style.backgroundImage = `conic-gradient(${colorsStr})`
    } else {
        console.error(`Element with class ${selector} .pie not found`)
    }

    if (elLegend) {
        const ledendHTML = labels.map((label, idx) => {
            return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
        }).join('')
        elLegend.innerHTML = ledendHTML
    } else {
        console.error(`Element with class ${selector} .legend not found`)
    }
}


function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}



function renderUpdatedStatsPie(selector) {
    locService.query().then(locs => {
        const countByUpdated = {
            today: 0,
            past: 0,
            never: 0,
            total: 0 
        }

        locs.forEach(loc => {
            const today = Date.now() - (24 * 60 * 60 * 1000);
            if (loc.updatedAt >= today) {
                countByUpdated.today++
            } else if (loc.updatedAt < today) {
                countByUpdated.past++
            } 
            
            if (loc.updatedAt === loc.createdAt) {
                countByUpdated.never++
            }
            countByUpdated.total++
        })

       
        handleStats(countByUpdated, selector)
    })
}





let gGroupByUpdated = 'today'
function onGroupByUpdated() {
    gGroupByUpdated = document.querySelector('.group-by-updated').value
    loadAndRenderLocs()
    
    
    renderUpdatedStatsPie('new-pie-chart')
}



function onSubmitModal() {
    const elModal = document.getElementById('update-modal')
    const elLocName = document.getElementById('Loc-name')
    const elLocRating = document.getElementById('Loc-rating')
    gCrnLoc.name = elLocName.value
    gCrnLoc.rate = elLocRating.value
    elModal.close()
    if (!gCrnLoc.name) return
    console.log(gCrnLoc)
    locService.save(gCrnLoc)
        .then((savedLoc) => {
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })

}