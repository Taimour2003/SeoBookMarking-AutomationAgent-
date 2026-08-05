function selectMedia(thumb) {
  document.querySelectorAll('.media-thumb').forEach(t => {
    t.classList.remove('ring-2', 'ring-purple-500');
    t.classList.add('opacity-70');
  });
  thumb.classList.add('ring-2', 'ring-purple-500');
  thumb.classList.remove('opacity-70');

  const container = document.getElementById('main-media');
  const type = thumb.dataset.type;
  const url = thumb.dataset.url;

  if (type === 'video') {
    container.innerHTML = '<video id="main-video" src="' + url + '" class="w-full h-full object-cover" autoplay muted loop playsinline controls></video>';
  } else {
    container.innerHTML = '<img id="main-image" src="' + url + '" alt="" class="w-full h-full object-cover">';
  }
}