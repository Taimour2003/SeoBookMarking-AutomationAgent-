let scrollContainer = document.getElementById('browse-thoughts');
let currentNodeSelected = null;
let disableReorder = false;


$(document).ready(function () {

    $("#thought-details").attr("placeholder", "Optional: Include details \n(Press ctrl+enter to quick add)")

    //    $("#browse-thoughts").onscroll(function () {
    //        console.log('test');
    //    });

    //    POPOVER HANDLERS ////////////////////////////////////////////////////
    var isVisible = false;

    var hideAllPopovers = function () {
        $('.popup-marker').each(function () {
            $(this).popover('hide');
        });
    };

    $('.popup-marker').popover({
        html: true,
        trigger: 'manual'
    }).on('click', function (e) {
        // if any other popovers are visible, hide them
        if (isVisible) {
            hideAllPopovers();
        }

        $(this).popover('show');

        // handle clicking on the popover itself
        $('.popover').off('click').on('click', function (e) {
            e.stopPropagation(); // prevent event for bubbling up => will not get caught with document.onclick
        });

        isVisible = true;
        e.stopPropagation();
    });


    $(document).on('click', function (e) {
        hideAllPopovers();
        isVisible = false;
    });

    $('body').on('hidden.bs.popover', function (e) {
        $(e.target).data("bs.popover").inState = {
            click: false,
            hover: false,
            focus: false
        }
    });

    ////////////////////////////////////////////////////////////////////////


    $("#searchclear").click(function () {
        $("#searchBar").val('');
        updateSearch();
    });


    document.getElementById('searchBar').onkeyup = updateSearch;


    function updateSearch() {
        searchNotes();

        let searchBar = document.getElementById('searchBar');

        if (searchBar.value == '') {
            disableReorder = false;
        } else {
            disableReorder = true;
        }
        toggleClickDrag();
    };


    $('#exitBtn').click(function () {
        window.close();
    });



    //    DRAG TO RE-ORDER CODE
    var el = document.getElementById('browse-thoughts-list');
    Sortable.create(el, {
        draggable: ".node",
        chosenClass: "sortable-chosen",
        animation: 200,
        handle: ".drag-handle",
        scroll: document.getElementById('browse-thoughts'),
        scrollSensitivity: 50,
        filter: ".ignore-elements",
        scrollSpeed: 10, // px
        onEnd: function (event) {
            try {


                chrome.storage.local.get({
                    thought_storage: []
                }, function (result) {

                    let thought_storage = result.thought_storage;
                    let numberOfNotes = thought_storage.length;

                    let selectedNodeIndex = numberOfNotes - 1 - event.oldIndex;
                    let targetIndex = numberOfNotes - 1 - event.newIndex;


                    if (selectedNodeIndex == targetIndex) {
                        return;
                    } else {
                        thought_storage = move(thought_storage, selectedNodeIndex, targetIndex);
                    }

                    chrome.storage.local.set({
                        thought_storage: thought_storage
                    })

                });

            } catch (err) {
                console.log(err);
                console.log('DRAG AND DROP ERROR');
            }


        }
    });

    $('#thought-details').keydown(function (e) {
        //If ctrl+enter is clicked
        if (e.ctrlKey && e.keyCode == 13) {

            $('#store-thought-btn').click();

        }
    });
    $('#thought-text').keydown(function (e) {
        //If ctrl+enter is clicked

        if (e.ctrlKey && e.keyCode == 13) {

            $('#store-thought-btn').click();

        }
    });

    //Save the input text in textboxes
    $("#thought-text").keyup(function () {
        let titleText = $(this).val();

        chrome.storage.local.set({
            TitleText: titleText
        });


    });
    $("#thought-details").keydown(function (e) {

        let shift_tab_press = false;
        let keyCode = e.keyCode || e.which;

        if (e.shiftKey && keyCode == 9) {
            e.preventDefault();
            $("#thought-text").focus();
            //            shift_tab_press = true;
        } else if (keyCode == 9) {
            let start = this.selectionStart;
            let end = this.selectionEnd;

            let $this = $(this);
            let value = $this.val();

            // set textarea value to: text before caret + tab + text after caret
            $this.val(value.substring(0, start) + "\t" + value.substring(end));

            // put caret at right position again (add one for the tab)
            this.selectionStart = this.selectionEnd = start + 1;

            // prevent the focus lose
            e.preventDefault();


        }

    });
    $("#thought-details").keyup(function () {
        let detailsText = $(this).val();

        chrome.storage.local.set({
            DetailsText: detailsText
        });


    })

    //When the app is opened, load whats was saved from previous text boxes
    chrome.storage.local.get(['TitleText', 'DetailsText'], function (result) {

        let titleText = result.TitleText;
        let detailsText = result.DetailsText;

        $("#thought-text").val(titleText);
        $("#thought-details").val(detailsText);

    })




    document.getElementById("thought-text").onkeypress = function (event) {
        submitNote(event);
    }

    Ps.initialize(scrollContainer, {
        wheelSpeed: 0.25
    });



    $('#store-thought-btn').click(function () {
        var id = Date.now();
        let thought = $("#thought-text").val();
        let thought_details = $("#thought-details").val();


        //        If the thought textbox is empty
        if (thought.trim() == '') {

            //Vibrate the textbox animation
            document.getElementById('thought-text').classList.add('hvr-buzz-out');
            setTimeout(function () {
                document.getElementById('thought-text').classList.remove('hvr-buzz-out');
            }, 1000)
            $(this).blur();
            return;
        }

        //Clear textboxes
        $("#thought-text").val('');
        $("#thought-details").val('');


        chrome.storage.local.set({
            TitleText: '',
            DetailsText: ''
        });

        addNode(thought, thought_details, id, false);
        addThoughtToStorage(thought, thought_details, id);

        $(this).blur();

    });


    $('#export-btn').click(function () {
        // @@@@@@@@@@@@@@@@@@@@@@@@
        chrome.storage.local.get({
            thought_storage: []
        }, function (result) {
            var notesArray = result.thought_storage;
            var cards = [];
            var cardIDs = [];

            notesArray.forEach((note) => {
                var date = new Date(note.id);
                var unixTimestamp = Math.floor(date.getTime() / 1000);

                var newCard = {
                    id: note.id,
                    text: note.thought,
                    description: note.thought_details,
                    createdAt: unixTimestamp,
                    labels: [],
                    lastModified: unixTimestamp,
                    creatorID: null,
                };

                cards.push(newCard);
                cardIDs.push(newCard.id);
            });


            var column = {
                id: 'colID',
                cardIDs: cardIDs.reverse(),
                name: 'Leaf list',
            };



            var exportData = {
                leaf: true,
                cards: cards,
                labels: [],
                columns: [
                    column
                ],
                board: {
                    columns: [
                        column.id,
                    ],
                    creatorID: null,
                    id: 'boardID',
                    name: 'Leaf Data'
                }
            };

            var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData));
            // Create a temporary anchor element
            var downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "leafData.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();




        });
    });


    document.getElementById('browse-thoughts').getElementsByClassName('ps__scrollbar-x-rail')[0].classList.add('ignore-elements');
    document.getElementById('browse-thoughts').getElementsByClassName('ps__scrollbar-y-rail')[0].classList.add('ignore-elements');


});



//Initialize
chrome.storage.local.get({
    thought_storage: []
}, function (result) {

    let numberOfThoughts = result.thought_storage.length;
    for (let i = 0; i < numberOfThoughts; i++) {
        let thought = result.thought_storage[i];

        addNode(thought.thought, thought.thought_details, thought.id, true);

    }
    checkIfNoNotes();


});

function checkIfNoNotes() {


    chrome.storage.local.get({
        thought_storage: []
    }, function (result) {

        let numberOfNotes = result.thought_storage;
        if (numberOfNotes.length == 0) {
            document.getElementById('browse-thoughts').style.backgroundImage = "url('NoNotesBright.png')";
        } else {
            document.getElementById('browse-thoughts').style.backgroundImage = '';
        }


    });

}

function addOptionBarClickListener(node) {

    $(node).click(function () {
        $(node).toggleClass('show-options-bar');
        optionsBarHandler(node);

    })

}

function optionsBarHandler(currentNode) {

    //Only one node can be selected at once
    if (currentNodeSelected != null) {
        if (currentNodeSelected != currentNode) {
            currentNodeSelected.getElementsByClassName('options-bar')[0].click();
        } else if (currentNodeSelected == currentNode) {
            currentNodeSelected = null;
        }
    }




    //Create and show the Options bar
    if ($(currentNode).hasClass('show-options-bar')) {
        let optionsBar = document.createElement('div');
        optionsBar.style.display = 'none';
        optionsBar.classList.add('options-bar');
        optionsBar.setAttribute('id', 'optionsBar');

        currentNode.prepend(optionsBar);

        $(optionsBar).slideDown('fast', addOptionButtons(optionsBar));

        currentNodeSelected = currentNode;


        //Delete the Options bar
    } else if (!$(currentNode).hasClass('show-options-bar')) {
        //        hideAllPopOvers();
        let optionsBar = currentNode.firstChild;
        $(optionsBar).slideUp('fast', function () {
            optionsBar.remove();

            let titleArea = currentNode.firstChild;
            titleArea.style.backgroundColor = 'rgb(234, 234, 234)';
            $(titleArea).prop('readonly', true);
            titleArea.onclick = function () {
                addOptionButtons(titleArea.parentNode);

            }

            let detailsArea = titleArea.nextSibling;

            titleArea.style.cursor = 'pointer';

            $(detailsArea).prop('readonly', true);
            detailsArea.onclick = function (event) {
                event.stopPropagation();

            }
        });



    }

    //    Dynamically add options buttons and functionality
    function addOptionButtons(optionsBar) {

        let node = optionsBar.parentNode;
        let titleTextArea = optionsBar.nextSibling;
        let detailsTextArea = titleTextArea.nextSibling;

        if (optionsBar.childElementCount == 0) {

            node.ondragstart = function () {
                $(detailsTextArea).slideUp();

            };
            node.ondragend = function () {
                $(detailsTextArea).slideDown();

            };



            let dragButton = document.createElement('span');
            dragButton.id = 'dragButton';
            dragButton.classList.add('option');
            dragButton.classList.add('glyphicon');
            dragButton.classList.add('glyphicon-move');
            //            dragButton.setAttribute('data-toggle', 'tooltip');
            dragButton.setAttribute("data-togle", 'tooltip');
            dragButton.setAttribute('data-container', 'body');
            $(dragButton).tooltip({
                delay: {
                    show: 500,
                    hide: 100
                },
                title: 'Move Note',
                placement: 'top'
            });
            if (disableReorder == false) {
                dragButton.classList.add('drag-handle');
                dragButton.style.cursor = 'move';
            } else {
                dragButton.style.cursor = 'no-drop';

            }
            dragButton.onclick = function (event) {
                event.stopPropagation();
            }
            dragButton.onmousedown = function () {
                $(dragButton).tooltip('hide');
                $(infoButton).popover('hide');
            }
            dragButton.classList.add('drag-handle-toggle');
            optionsBar.appendChild(dragButton);


            let toTopButton = document.createElement('span');
            toTopButton.id = 'toTopButton';
            toTopButton.classList.add('option');
            toTopButton.classList.add('glyphicon');
            toTopButton.classList.add('glyphicon-upload');
            toTopButton.setAttribute('data-container', 'body');
            $(toTopButton).tooltip({
                delay: {
                    show: 500,
                    hide: 100
                },
                title: 'Move Note to Top',
                placement: 'top'
            });
            toTopButton.onclick = function (event) {
                event.stopPropagation();
                $(toTopButton).tooltip('hide');
                bringToTop(optionsBar);

            }
            toTopButton.onmousedown = function () {
                $(infoButton).popover('hide');

            }
            optionsBar.appendChild(toTopButton);



            let deleteButton = document.createElement('span');
            deleteButton.classList.add('option');
            deleteButton.classList.add('glyphicon');
            deleteButton.classList.add('glyphicon-trash');
            deleteButton.id = 'deleteButton';
            deleteButton.setAttribute('data-container', 'body');
            $(deleteButton).tooltip({
                delay: {
                    show: 500,
                    hide: 100
                },
                title: 'Delete Note',
                placement: 'left'
            });
            optionsBar.appendChild(deleteButton);

            deleteButton.style.cursor = 'pointer';
            deleteButton.onclick = function () {
                $(deleteButton).tooltip('hide');
                deleteNode(optionsBar.parentNode);
            }





            let infoButton = document.createElement('span');
            infoButton.classList.add('option');
            infoButton.classList.add('glyphicon');
            infoButton.classList.add('glyphicon-info-sign');
            infoButton.classList.add('popup-marker');

            infoButton.id = 'infoButton';
            let dateID = currentNode.id;
            let date = new Date(+dateID).toUTCString();
            infoButton.style.cursor = 'pointer';
            infoButton.onclick = function (event) {
                $(infoButton).tooltip('hide');
                event.stopPropagation();
            }
            infoButton.setAttribute('data-toggle', 'popover');
            infoButton.setAttribute('data-placement', 'bottom');
            infoButton.setAttribute('data-content', 'Created on ' + date);
            infoButton.setAttribute('data-container', 'body');
            $(infoButton).tooltip({
                delay: {
                    show: 500,
                    hide: 100
                },
                title: 'Note Info',
                placement: 'top'
            });
            //            infoButton.appendChild(infoPopOver);
            optionsBar.appendChild(infoButton);
            $('[data-toggle="popover"]').popover();






            let editButton = document.createElement('span');
            editButton.classList.add('option');
            editButton.classList.add('glyphicon');
            editButton.classList.add('glyphicon-edit');
            editButton.id = 'editButton';
            optionsBar.appendChild(editButton);
            editButton.style.cursor = 'pointer';
            editButton.setAttribute('data-toggle', 'popover');
            editButton.setAttribute('title', 'Edit Note');
            editButton.setAttribute('data-container', 'body');
            $(editButton).tooltip({
                delay: {
                    show: 500,
                    hide: 100
                },
                title: 'Note Info',
                placement: 'top'
            });
            editButton.onclick = function (event) {
                $(editButton).tooltip('hide');

                $(document).click();
                event.stopPropagation();




                if (titleTextArea.hasAttribute('readonly') == false) {
                    optionsBar.click();
                    //                    titleTextArea.hasAttribute('readonly') = true;
                    //                    detailsTextArea.hasAttribute('readonly') = true;

                    return;
                }

                //                titleTextArea.disabled = false;
                titleTextArea.style.cursor = 'text';
                detailsTextArea.focus();
                titleTextArea.onclick = function (event) {
                    event.stopPropagation();
                }
                titleTextArea.style.backgroundColor = 'white';
                titleTextArea.removeAttribute('readonly');


                detailsTextArea.removeAttribute('readonly');

                detailsTextArea.style.cursor = 'text';
                detailsTextArea.style.backgroundColor = 'white';


                //            UPDATE DATABASE
                titleTextArea.onkeyup = function () {
                    updateNodeData(titleTextArea.parentNode)
                }
                detailsTextArea.onkeydown = function (e) {
                    let keyCode = e.keyCode || e.which;

                    if (keyCode == 9) {
                        let start = this.selectionStart;
                        let end = this.selectionEnd;

                        let $this = $(this);
                        let value = $this.val();

                        // set textarea value to: text before caret + tab + text after caret
                        $this.val(value.substring(0, start) + "\t" + value.substring(end));

                        // put caret at right position again (add one for the tab)
                        this.selectionStart = this.selectionEnd = start + 1;

                        // prevent the focus lose
                        e.preventDefault();

                    }
                }
                detailsTextArea.onkeyup = function () {

                    updateNodeData(detailsTextArea.parentNode)
                }


            }
        }


    }
}



function addThoughtToStorage(thought, thought_details, id) {
    chrome.storage.local.get({
        thought_storage: []
    }, function (result) {

        let thought_storage = result.thought_storage;

        let new_thought = new Object();
        new_thought["id"] = id;
        new_thought["thought"] = thought;
        new_thought["thought_details"] = thought_details;

        thought_storage.push(new_thought);

        chrome.storage.local.set({
            thought_storage: thought_storage
        }, function () {
            checkIfNoNotes();
        })

    })
}

function addNode(thought, thought_details, id, initialize) {
    let node = document.createElement("li");
    node.classList.add("node");

    let titleTextarea = document.createElement('textarea');
    titleTextarea.rows = 1;
    autosize(titleTextarea);
    titleTextarea.classList.add('title-text');
    titleTextarea.classList.add('editArea');
    titleTextarea.style.backgroundColor = 'rgb(234, 234, 234)';
    titleTextarea.style.borderBottom = '1px solid #dfdfdf';


    titleTextarea.style.cursor = 'pointer';
    $(titleTextarea).val(thought);
    $(titleTextarea).prop('readonly', true);

    //    titleTextarea.disabled = true;



    let detailsTextarea = document.createElement('textarea');
    detailsTextarea.rows = 1;
    autosize(detailsTextarea);
    detailsTextarea.classList.add('details-text');
    detailsTextarea.classList.add('editArea');
    detailsTextarea.style.backgroundColor = 'white';

    $(detailsTextarea).val(thought_details);
    $(detailsTextarea).prop('readonly', true);




    let invisibleTitleData = document.createElement('div');
    invisibleTitleData.classList.add('title-text-data');
    invisibleTitleData.style.display = 'none';
    $(invisibleTitleData).text(thought);

    let invisibleDetailsData = document.createElement('div');
    invisibleDetailsData.classList.add('details-text-data');
    invisibleDetailsData.style.display = 'none';
    $(invisibleDetailsData).text(thought_details);



    node.append(titleTextarea);
    node.append(detailsTextarea);
    titleTextarea.append(invisibleTitleData);
    detailsTextarea.append(invisibleDetailsData);
    node.id = id;




    document.getElementById("browse-thoughts-list").prepend(node);
    autosize.update(titleTextarea);
    autosize.update(detailsTextarea);




    if (initialize == false) node.style.display = 'none';


    if (initialize == false) $('#' + id).slideDown('fast');




    addOptionBarClickListener(node);
    Ps.update(scrollContainer);
    mostRecentAddedNode = node;

    $(detailsTextarea).click(function (event) {
        event.stopPropagation();
    });

    $(detailsTextarea).dblclick(function (event) {
        event.stopPropagation();



        if (detailsTextarea.hasAttribute('readonly') && node.firstChild.id != 'optionsBar') {
            node.click();
            let optionsbar = node.firstChild;
            let editbutton = optionsbar.querySelector("#editButton");
            editbutton.click();

        } else if (detailsTextarea.hasAttribute('readonly') == false) {

        } else if (node.firstChild.id == 'optionsBar') {
            let optionsbar = node.firstChild;
            let editbutton = optionsbar.querySelector("#editButton");
            editbutton.click();
        }
    })

}

function deleteThoughtFromStorage(id) {
    chrome.storage.local.get({
        thought_storage: []
    }, function (result) {

        let thought_storage = result.thought_storage;

        thought_storage = thought_storage.filter(thought => thought.id != id);



        chrome.storage.local.set({
            thought_storage: thought_storage
        }, function () {
            checkIfNoNotes();

        })

    })
}

function deleteNode(closeNode) {


    let idOfThought = closeNode.id;

    $('#' + idOfThought).slideUp('fast', function () {
        $('#' + idOfThought).remove();

    });

    deleteThoughtFromStorage(idOfThought);
    checkIfNoNotes();
    Ps.update(scrollContainer);
    //    checkIfNoNotes();


}



function updateNodeData(node) {

    let idOfNode = node.id;
    let titleTextArea = node.getElementsByClassName('title-text')[0];
    let titleText = titleTextArea.value;
    let titleData = titleTextArea.firstChild;
    titleData.innerHTML = titleTextArea.value;

    let detailsTextArea = node.getElementsByClassName('details-text')[0];
    let detailsText = detailsTextArea.value;
    let detailsData = detailsTextArea.firstChild;
    detailsData.innerHTML = detailsTextArea.value;

    chrome.storage.local.get({
        thought_storage: []
    }, function (result) {

        let thought_storage = result.thought_storage;

        //        console.log(thought_storage[0]['id']);
        //        console.log(idOfNode);

        for (let i = 0; i < thought_storage.length; i++) {
            //            console.log(i);
            if (thought_storage[i]['id'] == idOfNode) {
                thought_storage[i]['thought'] = titleText;
                thought_storage[i]['thought_details'] = detailsText;
                break;
            }
        }


        chrome.storage.local.set({
            thought_storage: thought_storage
        })

    })



}

function submitNote(e) {
    if (e.keyCode == 13) {
        //        document.getElementById("store-thought-btn").click();
        $('#thought-details').focus();

    }
}

function move(arr, old_index, new_index) {

    if (new_index >= arr.length) {
        var k = new_index - arr.length;
        while ((k--) + 1) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr; // for testing purposes

}

function searchNotes() {
    let input, filter, ul, li, titleNode, detailsNode, titleText, detailsText, i;
    input = document.getElementById("searchBar");
    filter = input.value.toUpperCase();
    ul = document.getElementById("browse-thoughts-list");
    li = ul.getElementsByTagName("li");

    for (i = 0; i < li.length; i++) {
        titleNode = li[i].getElementsByTagName("textarea")[0];
        titleText = titleNode.getElementsByTagName("div")[0];

        detailsNode = li[i].getElementsByTagName("textarea")[1];
        detailsText = detailsNode.getElementsByTagName("div")[0];




        if (titleText.innerHTML.toUpperCase().indexOf(filter) > -1 || detailsText.innerHTML.toUpperCase().indexOf(filter) > -1) {

            //            li[i].style.display = "";
            $(li[i]).slideDown('fast');

        } else {
            //            li[i].style.display = "none";
            $(li[i]).slideUp('fast');

        }
    }
}

function toggleClickDrag() {
    let dragHandles = document.getElementsByClassName('drag-handle-toggle');

    if (disableReorder == true) {
        for (let i = 0; i < dragHandles.length; i++) {
            dragHandles[i].style.cursor = 'no-drop'
            dragHandles[i].classList.remove('drag-handle');
        }
    } else if (disableReorder == false) {
        for (let i = 0; i < dragHandles.length; i++) {
            dragHandles[i].style.cursor = 'move'
            dragHandles[i].classList.add('drag-handle');

        }
    }

}

function bringToTop(optionsbar) {
    let node = optionsbar.parentNode;
    let titleTextArea = optionsbar.nextSibling;
    let detailsTextArea = titleTextArea.nextSibling;

    let titleText = titleTextArea.value;
    let detailsText = detailsTextArea.value;

    let idOfNode = optionsbar.parentNode.id;


    deleteThoughtFromStorage(idOfNode);

    $('#' + idOfNode).slideUp('fast', function () {
        $('#' + idOfNode).remove();

        addThoughtToStorage(titleText, detailsText, idOfNode);
        addNode(titleText, detailsText, idOfNode, false);

    });


    Ps.update(scrollContainer);






}