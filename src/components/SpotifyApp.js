import React from "react";

import Header from "./Header";
import LoginBtn from "./LoginBtn";
import UpdateBtn from "./UpdateBtn.js";
import GetPlaylistsBtn from "./GetPlaylistsBtn";
import ErrorMsg from "./ErrorMsg";
import TrackContext from "./TrackContext";
import Loading from "./Loading";
import PlaylistSelection from "./PlaylistSelection";
import TrackedPlaylists from "./TrackedPlaylists";

import API from "../api";

export default class SpotifyApp extends React.Component {
  state = {
    loginVisible: true,
    trackContext: "",
    getPlaylistsDisabled: false,
    showPlaylistsDiv: true,
    updateDisabled: false,
    showTrackedPlaylists: false,
    showPlaylists: false,
    errMsg: undefined,
    playlists: undefined,
    trackedPlaylists: [],
    loading: false
  };
  api = null;
  currentTrack = null;

  updateTimer = null;

  /**
   * Updates the UI
   * @async
   */
  update = async () => {
    try {
      const json = await this.api.currentPlayer();
      let currTrack = json.item;
      let newTrackUri = currTrack.uri;
      if (this.currentTrack === null || this.currentTrack.uri !== newTrackUri) {
        this.setTrackContext(currTrack);
      }
      this.markInPlaylist();
      if (this.updateTimer === null)
        this.updateTimer = setInterval(this.update, 2000);
      this.success();
    } catch (msg) {
      this.error(msg);
    }
  };

  /**
   * Takes a spotify track object and displays the name and artist to the user
   *
   * @param {Spotify Track Object} currentTrack
   */
  setTrackContext = currentTrack => {
    this.currentTrack = currentTrack;
    let trackContext = currentTrack.name + " by ";
    currentTrack.artists.forEach(artist => {
      trackContext += " " + artist.name + ",";
    });
    //remove trailing comma
    trackContext = trackContext.slice(0, trackContext.length - 1);
    this.setState(() => ({ trackContext }));
  };

  /**
   * gets a list of all users playlists and prints them on the DOM
   *
   * @async
   */
  getPlaylists = async () => {
    let showPlaylists = !this.state.showPlaylists;

    if (this.state.playlists === undefined) {
      try {
        const playlists = await this.api.getPlaylists();
        this.setState({
          playlists
        });
        this.success();
      } catch (msg) {
        this.error(msg);
        //do not show playlists on error
        showPlaylists = false;
      }
    }

    this.setState(() => ({ showPlaylists }));

    if (this.state.trackedPlaylists.length > 0) {
      let promises = [];

      this.setState(() => ({
        getPlaylistsDisabled: true,
        updateDisabled: true,
        showTrackedPlaylists: true,
        loading: true
      }));

      this.state.trackedPlaylists.forEach(playlist => {
        promises.push(this.api.addPlaylistByID(playlist.id, playlist.name));
      });
      Promise.all(promises)
        .then(() => {
          this.setState({
            loading: false,
            updateDisabled: false,
            getPlaylistsDisabled: false
          });
          getPlaylistsBtn.disabled = false;
          updateBtn.disabled = false;
        })
        .catch(msg => error(msg));
    }
  };

  //When the user clicks on a playlist it will become selected/unselected
  selectPlaylist = e => {
    try {
      e.persist();
      if (e.target.tagName === "A") e.target.classList.toggle("active");
      if (e.target.classList.contains("active"))
        this.setState(prevState => ({
          trackedPlaylists: prevState.trackedPlaylists.concat({
            name: e.target.text,
            id: e.target.id,
            found: false
          })
        }));
      else {
        this.setState(prevState => {
          return {
            trackedPlaylists: prevState.trackedPlaylists.filter(
              item => item.id !== e.target.id
            )
          };
        });
        this.api.removePlaylist(e.target.id);
      }
    } catch (err) {
      this.error(err);
    }
  };

  /**
   * Asks the API if current track is in playlist, if it is display that to the user,
   * adds remove and add buttons to each playlist in the tracked playlist list
   */
  markInPlaylist = () => {
    const inPlaylists = this.api.currentTrackInPlaylists();
    const trackedPlaylists = this.state.trackedPlaylists;

    trackedPlaylists.forEach(child => {
      child.found = false;
    });

    inPlaylists.forEach(inPl => {
      const pl = trackedPlaylists.find(element => element.name === inPl.name);
      pl.found = true;
    });
  };

  addOrRemove = async e => {
    if (e.target.tagName === "BUTTON") {
      e.persist();
      e.target.disabled = true;
      const playlist_id = e.target.parentElement.id;
      let track_uri = this.currentTrack.uri;
      let promise = null;
      try {
        if (e.target.classList.contains("remove")) {
          await this.api.removeTrackFromPlaylist(
            playlist_id,
            this.currentTrack
          );
        } else {
          await this.api.addTrackToPlaylist(playlist_id, this.currentTrack);
        }
        this.update().finally(() => {
          e.target.disabled = false;
        });
      } catch (err) {
        this.error(err);
      }
    }
  };

  //clears the error msg on success
  success = () => {
    this.setState(() => ({ errMsg: undefined }));
  };

  //handles error msgs given from rejected promises
  error = error => {
    console.log(error);
    const errLoc = document.querySelector("#errMsg");
    let msg = error.message;
    if (!isNaN(msg)) {
      const status = parseInt(msg);
      switch (status) {
        case 401:
          msg = "Please login, sessions are only valid for one hour";
          this.setState(() => ({ loginVisible: true }));
          break;
        case 429:
          msg =
            "Error: too many requests to spotify api, please wait a little and try again";
          break;
        default: {
          msg = status;
        }
      }
    }
    this.setState(() => ({ errMsg: msg }));
  };

  componentDidMount() {
    let hash = location.hash;

    if (location.hash !== "") {
      this.setState(() => ({ loginVisible: false }));
    }
    hash = hash.replace("#", "?");
    const urlParams = new URLSearchParams(hash);

    this.api = new API(urlParams.get("access_token"));
  }

  render() {
    return (
      <div>
        <div className="container justify-content-center">
          <Header />
          <LoginBtn loginVisible={this.state.loginVisible} />
          <UpdateBtn
            disabled={this.state.updateDisabled}
            update={this.update}
          />
          <GetPlaylistsBtn
            getPlaylists={this.getPlaylists}
            disabled={this.state.getPlaylistsDisabled}
          />
          <ErrorMsg msg={this.state.errMsg} />
          <TrackContext trackContext={this.state.trackContext} />
          <Loading loading={this.state.loading} />
          <PlaylistSelection
            showPlaylists={this.state.showPlaylists}
            playlists={this.state.playlists}
            selectPlaylist={this.selectPlaylist}
          />
          <TrackedPlaylists
            trackedPlaylists={this.state.trackedPlaylists}
            addOrRemove={this.addOrRemove}
          />
        </div>
      </div>
    );
  }
}
